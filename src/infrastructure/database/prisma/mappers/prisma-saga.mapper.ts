import {
  SagaInstance as PrismaSagaInstance,
  SagaStepLog as PrismaSagaStepLog,
  Prisma,
} from '@generated/prisma/client';
import {
  SagaLogOutcome,
  SagaStepLog,
} from '@domain/repositories/saga.repository.interface';
import { SagaInstanceEntity } from '@domain/entities/saga/saga-instance.entity';
import { SagaStatus, SagaStep } from '@domain/enums/saga.enum';

export class PrismaSagaMapper {
  private constructor() {
    throw new Error(
      'PrismaSagaMapper is a static class and cannot be instantiated.',
    );
  }

  public static toPrisma(
    saga: SagaInstanceEntity,
  ): Prisma.SagaInstanceUncheckedCreateInput {
    return {
      id: saga.id,
      orderId: saga.orderId,
      step: saga.step,
      status: saga.status,
      deadlineAt: saga.deadlineAt ?? null,
      lastError: saga.lastError ?? null,
      createdAt: saga.createdAt,
      updatedAt: saga.updatedAt,
    };
  }

  public static toEntity(prisma: PrismaSagaInstance): SagaInstanceEntity {
    return SagaInstanceEntity.reconstitute(
      {
        orderId: prisma.orderId,
        step: prisma.step as SagaStep,
        status: prisma.status as SagaStatus,
        deadlineAt: prisma.deadlineAt ?? undefined,
        lastError: prisma.lastError ?? undefined,
        createdAt: prisma.createdAt,
        updatedAt: prisma.updatedAt,
      },
      prisma.id,
    );
  }

  public static toLog(prisma: PrismaSagaStepLog): SagaStepLog {
    return {
      sagaId: prisma.sagaId,
      step: prisma.step as SagaStep,
      eventType: prisma.eventType,
      messageId: prisma.messageId ?? undefined,
      outcome: prisma.outcome as SagaLogOutcome,
      detail: prisma.detail ?? undefined,
      createdAt: prisma.createdAt,
    };
  }
}
