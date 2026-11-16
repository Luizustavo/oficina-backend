import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { IMessagePublisher } from '@domain/services/message-publisher.interface';
import { rabbitmqConfig } from '@infrastructure/config/rabbitmq.config';
import { OutgoingMessage } from '@domain/messaging/saga-message';
import { RabbitMqConnection } from './rabbitmq-connection.service';
import { ChannelWrapper } from 'amqp-connection-manager';
import { assertOsTopology } from './topology';

import type { ConfirmChannel, ConsumeMessage, Options } from 'amqplib';

/** Nenhuma fila recebeu a mensagem (ex.: o serviço de destino nunca subiu). */
export class UnroutableMessageError extends Error {
  constructor(exchange: string, routingKey: string) {
    super(`No queue bound to ${exchange} for routing key ${routingKey}`);
    this.name = 'UnroutableMessageError';
  }
}

export type RawPublishOptions = Options.Publish & { messageId: string };

/**
 * Publica no RabbitMQ com *publisher confirms*: a promise só resolve quando o
 * broker confirma (contrato, seção 2: propriedades AMQP).
 *
 * Toda publicação é `mandatory`. Sem isso, uma mensagem para uma fila que
 * ainda não existe (o Billing nunca subiu, por exemplo) seria descartada pelo
 * broker e mesmo assim confirmada. Com `mandatory`, o broker devolve a
 * mensagem antes da confirmação, e aqui ela vira erro: o relay mantém a linha
 * pendente no outbox e tenta de novo depois.
 */
@Injectable()
export class RabbitMqMessagePublisher
  implements IMessagePublisher, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RabbitMqMessagePublisher.name);
  private readonly config = rabbitmqConfig().rabbitmq;
  private channel?: ChannelWrapper;
  private readonly returned = new Set<string>();

  constructor(private readonly connection: RabbitMqConnection) {}

  onModuleInit(): void {
    if (!this.connection.enabled) {
      this.logger.warn(
        'RABBITMQ_URL not set: messaging disabled, outbox messages will wait in the database',
      );
      return;
    }
    this.channel = this.connection.createChannel({
      name: 'os-publisher',
      confirm: true,
      json: false,
      publishTimeout: this.config.publishTimeoutMs,
      setup: async (channel: ConfirmChannel) => {
        await assertOsTopology(channel);
        // O broker devolve aqui a mensagem `mandatory` sem destino, antes de
        // confirmá-la; `publishRaw` confere este conjunto após a confirmação.
        channel.on('return', (msg: ConsumeMessage) => {
          const id = msg.properties.messageId as string | undefined;
          if (id) this.returned.add(id);
        });
      },
    });
  }

  async publish(
    message: OutgoingMessage,
    trace: { traceparent?: string; tracestate?: string } = {},
  ): Promise<void> {
    const { envelope } = message;
    const headers: Record<string, string> = {};
    if (trace.traceparent) headers.traceparent = trace.traceparent;
    if (trace.tracestate) headers.tracestate = trace.tracestate;

    await this.publishRaw(
      message.exchange,
      message.routingKey,
      Buffer.from(JSON.stringify(envelope)),
      {
        messageId: envelope.messageId,
        correlationId: envelope.sagaId,
        type: envelope.type,
        headers,
      },
    );
  }

  /**
   * Publicação de baixo nível, usada também pelo consumidor para mandar uma
   * mensagem recebida para a fila de espera ou para a DLQ sem alterar o corpo.
   */
  async publishRaw(
    exchange: string,
    routingKey: string,
    content: Buffer,
    options: RawPublishOptions,
  ): Promise<void> {
    if (!this.channel) {
      throw new Error('Messaging is disabled: RABBITMQ_URL is not set');
    }
    const id = options.messageId;
    this.returned.delete(id);
    await this.channel.publish(exchange, routingKey, content, {
      ...options,
      contentType: 'application/json',
      persistent: true,
      mandatory: true,
    });
    if (this.returned.delete(id)) {
      throw new UnroutableMessageError(exchange, routingKey);
    }
  }

  /** Resolve quando o canal estiver conectado e a topologia declarada. */
  async whenReady(): Promise<void> {
    await this.channel?.waitForConnect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
  }
}
