import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ExpireSagaDeadlinesUseCase } from '@application/use-cases/saga/expire-saga-deadlines.use-case';
import { sagaConfig } from '@infrastructure/config/saga.config';

/**
 * Roda a varredura de prazos da saga periodicamente. Independe do RabbitMQ:
 * os comandos de compensação vão para o outbox e saem quando o broker estiver
 * disponível.
 */
@Injectable()
export class SagaDeadlineScheduler
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(SagaDeadlineScheduler.name);
  private readonly config = sagaConfig().saga;
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly expireDeadlines: ExpireSagaDeadlinesUseCase) {}

  onApplicationBootstrap(): void {
    if (this.config.sweepIntervalMs <= 0) return;
    this.timer = setInterval(
      () => void this.tick(),
      this.config.sweepIntervalMs,
    );
    // Não segura o processo vivo (testes, desligamento).
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.expireDeadlines.execute();
    } catch (error) {
      this.logger.error(
        `Saga deadline sweep failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.running = false;
    }
  }
}
