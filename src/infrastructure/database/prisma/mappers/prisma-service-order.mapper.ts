import {
  Prisma,
  ServiceOrder as PrismaServiceOrder,
} from '@generated/prisma/client';
import {
  ServiceItem,
  PartItem,
} from '@domain/entities/service-order/service-order-items.value-object';
import { ServiceOrderEntity } from '@domain/entities/service-order/service-order.entity';
import { ServiceOrderStatus } from '@domain/validators/value-objects/service-order-status.value-object';

export class PrismaServiceOrderMapper {
  private constructor() {
    throw new Error(
      'PrismaServiceOrderMapper is a static class and cannot be instantiated.',
    );
  }

  public static toPrisma(
    entity: ServiceOrderEntity,
  ): Prisma.ServiceOrderUncheckedCreateInput {
    return {
      id: entity.id,
      orderNumber: entity.orderNumber,
      customerId: entity.customerId,
      vehicleId: entity.vehicleId,
      problemDescription: entity.problemDescription,
      services: entity.services as unknown as Prisma.InputJsonValue,
      parts: entity.parts as unknown as Prisma.InputJsonValue,
      totalAmount: entity.totalAmount,
      notes: entity.notes,
      approvedAt: entity.approvedAt,
      startedAt: entity.startedAt,
      finishedAt: entity.finishedAt,
      deliveredAt: entity.deliveredAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      status: entity.status,
    };
  }

  public static toEntity(prisma: PrismaServiceOrder): ServiceOrderEntity {
    return ServiceOrderEntity.reconstitute(
      {
        orderNumber: prisma.orderNumber,
        customerId: prisma.customerId,
        vehicleId: prisma.vehicleId,
        problemDescription: prisma.problemDescription,
        services: prisma.services as unknown as ServiceItem[],
        parts: prisma.parts as unknown as PartItem[],
        totalAmount: prisma.totalAmount.toNumber(),
        notes: prisma.notes ?? undefined,
        approvedAt: prisma.approvedAt ?? undefined,
        startedAt: prisma.startedAt ?? undefined,
        finishedAt: prisma.finishedAt ?? undefined,
        deliveredAt: prisma.deliveredAt ?? undefined,
        createdAt: prisma.createdAt,
        updatedAt: prisma.updatedAt,
        status: prisma.status as ServiceOrderStatus,
      },
      prisma.id,
    );
  }
}
