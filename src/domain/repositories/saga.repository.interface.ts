import { SagaInstanceEntity } from '@domain/entities/saga/saga-instance.entity';
import { SagaStep } from '@domain/enums/saga.enum';

/** Como um evento foi tratado, para o histórico da saga. */
export enum SagaLogOutcome {
  STARTED = 'STARTED',
  APPLIED = 'APPLIED',
  /** Evento de um passo já superado: confirmado sem efeito. */
  IGNORED_STALE = 'IGNORED_STALE',
  /** Evento para uma saga encerrada: confirmado sem efeito (anomalia). */
  IGNORED_FINISHED = 'IGNORED_FINISHED',
}

export interface SagaStepLog {
  sagaId: string;
  /** Passo em que a saga ficou depois do evento. */
  step: SagaStep;
  eventType: string;
  messageId?: string;
  outcome: SagaLogOutcome;
  detail?: string;
  createdAt?: Date;
}

export abstract class ISagaRepository {
  abstract create(saga: SagaInstanceEntity): Promise<SagaInstanceEntity>;
  abstract update(saga: SagaInstanceEntity): Promise<SagaInstanceEntity>;
  abstract findById(id: string): Promise<SagaInstanceEntity | null>;
  /** A saga mais recente da OS (ADR-011: uma saga por tentativa). */
  abstract findCurrentByOrderId(
    orderId: string,
  ): Promise<SagaInstanceEntity | null>;
  abstract appendLog(log: SagaStepLog): Promise<void>;
  abstract findLogs(sagaId: string): Promise<SagaStepLog[]>;
}
