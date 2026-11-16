import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { IMessagePublisher } from '@domain/services/message-publisher.interface';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { rabbitmqConfig } from '@infrastructure/config/rabbitmq.config';
import { SagaEnvelope } from '@domain/messaging/saga-message';

interface PendingRow {
  id: string;
  exchange: string;
  routingKey: string;
  payload: SagaEnvelope;
  traceparent: string | null;
  tracestate: string | null;
}

/**
 * Tempo máximo publicando dentro de uma rodada. Fica abaixo do limite da
 * transação (15 s, PrismaService): com o broker lento, o lote para no meio, o
 * que já saiu é marcado e o resto fica para a próxima rodada.
 */
const ROUND_BUDGET_MS = 10_000;

/**
 * Relay do Transactional Outbox (ADR-010): publica no RabbitMQ as mensagens
 * gravadas pelos casos de uso e marca `publishedAt`.
 *
 * - **Uma réplica por linha.** As pendentes são lidas com
 *   `FOR UPDATE SKIP LOCKED` dentro de uma transação: com várias réplicas do
 *   OS Service (HPA), cada uma pega um lote diferente.
 * - **Ordem preservada.** O lote sai em ordem de criação e o relay para na
 *   primeira falha, em vez de pular para a próxima: um comando nunca passa à
 *   frente de outro mais antigo da mesma saga.
 * - **Pelo menos uma vez.** Se o processo cair depois de publicar e antes de
 *   confirmar a transação, a mensagem sai de novo na próxima rodada, com o
 *   mesmo messageId. Os consumidores são idempotentes por isso.
 */
@Injectable()
export class OutboxRelayService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(OutboxRelayService.name);
  private readonly config = rabbitmqConfig().rabbitmq;
  private running = false;
  private lastFailure?: string;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: IMessagePublisher,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.enabled) return;
    this.timer = setInterval(
      () => void this.tick(),
      this.config.relayIntervalMs,
    );
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    // Uma rodada lenta (broker reconectando) não pode empilhar outra por cima.
    if (this.running) return;
    this.running = true;
    try {
      await this.publishPending();
    } catch (error) {
      this.logger.error(`Outbox relay round failed: ${describe(error)}`);
    } finally {
      this.running = false;
    }
  }

  /** Publica um lote de pendentes. Retorna quantas foram publicadas. */
  async publishPending(): Promise<number> {
    return this.prisma.runInTransaction(async () => {
      const rows = await this.prisma.$queryRawUnsafe<PendingRow[]>(
        `SELECT "id", "exchange", "routingKey", "payload", "traceparent", "tracestate"
           FROM "outbox_messages"
          WHERE "publishedAt" IS NULL
          ORDER BY "createdAt"
          LIMIT $1
          FOR UPDATE SKIP LOCKED`,
        this.config.relayBatchSize,
      );

      const startedAt = Date.now();
      const published: string[] = [];
      for (const row of rows) {
        if (Date.now() - startedAt > ROUND_BUDGET_MS) break;
        try {
          await this.publisher.publish(
            {
              exchange: row.exchange,
              routingKey: row.routingKey,
              envelope: row.payload,
            },
            {
              traceparent: row.traceparent ?? undefined,
              tracestate: row.tracestate ?? undefined,
            },
          );
          published.push(row.id);
        } catch (error) {
          this.warnOnce(row, error);
          break;
        }
      }

      if (published.length > 0) {
        await this.prisma.outboxMessage.updateMany({
          where: { id: { in: published } },
          data: { publishedAt: new Date() },
        });
        this.lastFailure = undefined;
        this.logger.log(
          `Outbox relay published ${published.length} message(s)`,
        );
      }
      return published.length;
    });
  }

  /** Com o broker fora, a mesma falha se repetiria a cada segundo no log. */
  private warnOnce(row: PendingRow, error: unknown): void {
    const failure = `${row.id}:${describe(error)}`;
    if (failure === this.lastFailure) return;
    this.lastFailure = failure;
    this.logger.warn(
      `Could not publish outbox message ${row.id} (${row.routingKey}), will retry: ${describe(error)}`,
    );
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
