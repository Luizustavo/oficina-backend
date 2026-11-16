import {
  SagaStepLogResponseDto,
  ServiceOrderSagaResponseDto,
} from '@application/dtos/response/saga.dto';
import { SagaInstanceEntity } from '@domain/entities/saga/saga-instance.entity';
import { SagaStepLog } from '@domain/repositories/saga.repository.interface';

export class SagaMapper {
  private constructor() {
    throw new Error('SagaMapper is a static class and cannot be instantiated.');
  }

  public static toResponse(
    saga: SagaInstanceEntity,
    logs: SagaStepLog[],
  ): ServiceOrderSagaResponseDto {
    return {
      sagaId: saga.id,
      orderId: saga.orderId,
      status: saga.status,
      step: saga.step,
      deadlineAt: saga.deadlineAt,
      lastError: saga.lastError,
      createdAt: saga.createdAt,
      updatedAt: saga.updatedAt,
      history: logs.map(
        (log): SagaStepLogResponseDto => ({
          step: log.step,
          eventType: log.eventType,
          messageId: log.messageId,
          outcome: log.outcome,
          detail: log.detail,
          createdAt: log.createdAt,
        }),
      ),
    };
  }
}
