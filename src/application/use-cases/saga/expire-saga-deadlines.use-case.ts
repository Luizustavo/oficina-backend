import { ProcessSagaEventUseCase } from '@application/use-cases/saga/process-saga-event.use-case';
import { ISagaRepository } from '@domain/repositories/saga.repository.interface';
import { SagaEvent } from '@application/saga/service-order-saga';
import { Injectable, Logger } from '@nestjs/common';
import { SagaStep } from '@domain/enums/saga.enum';

/** Sagas tratadas por rodada da varredura. */
const BATCH_SIZE = 20;

/** Evento interno de prazo vencido para cada passo que tem prazo. */
const TIMEOUT_EVENT: Partial<Record<SagaStep, string>> = {
  [SagaStep.AWAITING_APPROVAL]: SagaEvent.APPROVAL_TIMEOUT,
  [SagaStep.AWAITING_PAYMENT]: SagaEvent.PAYMENT_TIMEOUT,
};

/**
 * Varredura de prazos da saga (ADR-011, "Timeouts"): sagas em andamento com
 * o prazo vencido recebem o evento interno de timeout do passo atual e
 * compensam como numa recusa (cancelam o orçamento e, no pagamento, devolvem
 * as peças).
 *
 * Seguro com várias réplicas: cada evento passa pelo ProcessSagaEventUseCase,
 * que trava a saga. Se outra réplica (ou um evento do Billing) chegou antes,
 * o timeout encontra a saga em outro passo e é ignorado como superado.
 */
@Injectable()
export class ExpireSagaDeadlinesUseCase {
  constructor(
    private readonly sagaRepository: ISagaRepository,
    private readonly processSagaEvent: ProcessSagaEventUseCase,
    private readonly logger: Logger,
  ) {}

  /** Retorna quantas sagas tiveram o prazo vencido aplicado. */
  async execute(now: Date = new Date()): Promise<number> {
    const expired = await this.sagaRepository.findExpired(now, BATCH_SIZE);
    let applied = 0;

    for (const saga of expired) {
      const type = TIMEOUT_EVENT[saga.step];
      if (!type) continue;

      this.logger.warn(
        `Saga ${saga.id} (order ${saga.orderId}) missed its ${saga.step} deadline (${saga.deadlineAt?.toISOString()})`,
      );
      try {
        const result = await this.processSagaEvent.execute({
          type,
          orderId: saga.orderId,
          sagaId: saga.id,
        });
        if (result.outcome === 'applied') applied++;
      } catch (error) {
        // Uma saga com problema não pode travar a varredura das outras.
        this.logger.error(
          `Could not expire saga ${saga.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (applied > 0) {
      this.logger.log(`Expired ${applied} saga deadline(s)`);
    }
    return applied;
  }
}
