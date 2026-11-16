import {
  ISagaRepository,
  SagaStepLog,
} from '@domain/repositories/saga.repository.interface';
import { PrismaSagaMapper } from '@infrastructure/database/prisma/mappers/prisma-saga.mapper';
import { SagaInstanceEntity } from '@domain/entities/saga/saga-instance.entity';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class SagaRepository implements ISagaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(saga: SagaInstanceEntity): Promise<SagaInstanceEntity> {
    const created = await this.prisma.sagaInstance.create({
      data: PrismaSagaMapper.toPrisma(saga),
    });
    return PrismaSagaMapper.toEntity(created);
  }

  async update(saga: SagaInstanceEntity): Promise<SagaInstanceEntity> {
    const updated = await this.prisma.sagaInstance.update({
      where: { id: saga.id },
      data: {
        step: saga.step,
        status: saga.status,
        deadlineAt: saga.deadlineAt ?? null,
        lastError: saga.lastError ?? null,
      },
    });
    return PrismaSagaMapper.toEntity(updated);
  }

  async findById(id: string): Promise<SagaInstanceEntity | null> {
    const found = await this.prisma.sagaInstance.findUnique({ where: { id } });
    return found ? PrismaSagaMapper.toEntity(found) : null;
  }

  async findCurrentByOrderId(
    orderId: string,
  ): Promise<SagaInstanceEntity | null> {
    const found = await this.prisma.sagaInstance.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
    return found ? PrismaSagaMapper.toEntity(found) : null;
  }

  async appendLog(log: SagaStepLog): Promise<void> {
    await this.prisma.sagaStepLog.create({
      data: {
        sagaId: log.sagaId,
        step: log.step,
        eventType: log.eventType,
        messageId: log.messageId ?? null,
        outcome: log.outcome,
        detail: log.detail ?? null,
      },
    });
  }

  async findLogs(sagaId: string): Promise<SagaStepLog[]> {
    const logs = await this.prisma.sagaStepLog.findMany({
      where: { sagaId },
      orderBy: { createdAt: 'asc' },
    });
    return logs.map((log) => PrismaSagaMapper.toLog(log));
  }
}
