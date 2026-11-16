import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { InvalidMessageException } from '@shared/exceptions/domain.exceptions';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { rabbitmqConfig } from '@infrastructure/config/rabbitmq.config';
import { SagaMessageHandlerRegistry } from './saga-message-handler.registry';
import { RabbitMqMessagePublisher } from './rabbitmq-message-publisher';
import {
  parseSagaEnvelope,
  SagaExchange,
} from '@domain/messaging/saga-message';
import { assertOsTopology, OS_SAGA_EVENTS_QUEUE } from './topology';
import { decideOnFailure } from '@domain/messaging/retry-policy';
import { RabbitMqConnection } from './rabbitmq-connection.service';
import { ChannelWrapper } from 'amqp-connection-manager';

import type { Channel, ConsumeMessage } from 'amqplib';

export type ConsumeOutcome =
  | 'processed'
  | 'duplicate'
  | 'retried'
  | 'dead-lettered'
  | 'rejected';

/**
 * Consumidor da fila `os.saga-events` (eventos do Billing e do Execution),
 * seguindo a seção 4 do contrato:
 *
 * - **Idempotência.** O `messageId` é gravado em `processed_messages` na
 *   mesma transação do efeito do tratador. Se a linha já existe, a mensagem
 *   é uma reentrega: confirma (`ack`) sem fazer nada.
 * - **Mensagem inválida** (JSON quebrado, `type`/`version` desconhecidos):
 *   `nack` sem requeue, vai direto para a DLQ.
 * - **Falha transitória:** republica na fila de espera (5 s, 30 s, 2 min) com
 *   `x-retry-count` e confirma a original. Depois da terceira, DLQ.
 */
@Injectable()
export class SagaEventsConsumer
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(SagaEventsConsumer.name);
  private readonly config = rabbitmqConfig().rabbitmq;
  private channel?: ChannelWrapper;

  constructor(
    private readonly connection: RabbitMqConnection,
    private readonly publisher: RabbitMqMessagePublisher,
    private readonly registry: SagaMessageHandlerRegistry,
    private readonly prisma: PrismaService,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.connection.enabled) return;
    this.channel = this.connection.createChannel({
      name: 'os-saga-events-consumer',
      setup: async (channel: Channel) => {
        await assertOsTopology(channel);
        await channel.prefetch(this.config.prefetch);
        await channel.consume(
          OS_SAGA_EVENTS_QUEUE,
          (msg) => {
            if (msg) void this.onMessage(channel, msg);
          },
          { noAck: false },
        );
      },
    });
  }

  /** Resolve quando o consumo da fila tiver começado. */
  async whenReady(): Promise<void> {
    await this.channel?.waitForConnect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
  }

  private async onMessage(
    channel: Channel,
    msg: ConsumeMessage,
  ): Promise<void> {
    try {
      const outcome = await this.handle(msg);
      if (outcome === 'rejected') {
        channel.nack(msg, false, false);
      } else {
        channel.ack(msg);
      }
    } catch (error) {
      // Nem a retentativa conseguiu ser publicada (broker instável): devolve
      // para a fila e tenta de novo, sem perder a mensagem.
      this.logger.error(
        `Could not settle message ${String(msg.properties.messageId)}: ${describe(error)}`,
      );
      channel.nack(msg, false, true);
    }
  }

  /**
   * Processa uma mensagem e diz o que fazer com ela. Separado de `onMessage`
   * para os testes de integração verificarem cada desfecho.
   */
  async handle(msg: ConsumeMessage): Promise<ConsumeOutcome> {
    const body = msg.content.toString('utf8');
    let envelope;
    try {
      envelope = parseSagaEnvelope(body);
      if (!this.registry.find(envelope.type, envelope.version)) {
        throw new InvalidMessageException(
          `No handler for ${envelope.type} v${envelope.version}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Rejecting invalid message ${String(msg.properties.messageId)} from ${OS_SAGA_EVENTS_QUEUE}: ${describe(error)}`,
      );
      return 'rejected';
    }

    const handler = this.registry.find(envelope.type, envelope.version)!;
    const context = `${envelope.type} ${envelope.messageId} (saga ${envelope.sagaId}, order ${envelope.orderId})`;

    try {
      const processed = await this.prisma.runInTransaction(async () => {
        const inserted = await this.prisma.$executeRawUnsafe(
          `INSERT INTO "processed_messages" ("messageId", "queue", "messageType")
           VALUES ($1, $2, $3)
           ON CONFLICT ("messageId") DO NOTHING`,
          envelope.messageId,
          OS_SAGA_EVENTS_QUEUE,
          envelope.type,
        );
        if (inserted === 0) return false;
        await handler.handle(envelope);
        return true;
      });

      if (!processed) {
        this.logger.log(`Duplicate ${context} acknowledged without effect`);
        return 'duplicate';
      }
      this.logger.log(`Processed ${context}`);
      return 'processed';
    } catch (error) {
      return this.handleFailure(msg, context, error);
    }
  }

  private async handleFailure(
    msg: ConsumeMessage,
    context: string,
    error: unknown,
  ): Promise<ConsumeOutcome> {
    const headers = msg.properties.headers ?? {};
    const retryCount = Number(headers['x-retry-count'] ?? 0);
    const decision = decideOnFailure(OS_SAGA_EVENTS_QUEUE, retryCount, error);

    if (decision.action === 'reject') {
      this.logger.warn(`Rejecting ${context}: ${describe(error)}`);
      return 'rejected';
    }

    const options = {
      ...msg.properties,
      messageId: String(msg.properties.messageId),
      headers: { ...headers },
    };

    if (decision.action === 'retry') {
      options.headers['x-retry-count'] = decision.attempt;
      await this.publisher.publishRaw(
        '',
        decision.retryQueue,
        msg.content,
        options,
      );
      this.logger.warn(
        `Failed ${context}, retry ${decision.attempt} via ${decision.retryQueue}: ${describe(error)}`,
      );
      return 'retried';
    }

    await this.publisher.publishRaw(
      SagaExchange.DEAD_LETTER,
      OS_SAGA_EVENTS_QUEUE,
      msg.content,
      options,
    );
    this.logger.error(
      `Failed ${context} after ${retryCount} retries, sent to dead letter queue: ${describe(error)}`,
    );
    return 'dead-lettered';
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
