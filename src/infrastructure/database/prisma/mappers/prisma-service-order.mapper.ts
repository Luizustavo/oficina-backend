import {
  ServiceOrderService as PrismaServiceOrderService,
  ServiceOrderPart as PrismaServiceOrderPart,
  ServiceOrder as PrismaServiceOrder,
  Prisma,
} from '@generated/prisma/client';
import {
  ServiceItem,
  PartItem,
} from '@domain/entities/service-order/service-order-items.value-object';
import { ServiceOrderEntity } from '@domain/entities/service-order/service-order.entity';
import { ServiceOrderStatus } from '@domain/validators/value-objects/service-order-status.value-object';

/**
 * A ordem carregada do banco sempre traz os itens junto — sem eles a entidade
 * não consegue recalcular o total nem responder pelo que foi orçado.
 */
export type PrismaServiceOrderWithItems = PrismaServiceOrder & {
  services: PrismaServiceOrderService[];
  parts: PrismaServiceOrderPart[];
};

export class PrismaServiceOrderMapper {
  private constructor() {
    throw new Error(
      'PrismaServiceOrderMapper is a static class and cannot be instantiated.',
    );
  }

  /** Campos da própria ordem, sem os itens — eles são escritos como relação. */
  public static toPrisma(
    entity: ServiceOrderEntity,
  ): Omit<Prisma.ServiceOrderUncheckedCreateInput, 'services' | 'parts'> {
    return {
      id: entity.id,
      orderNumber: entity.orderNumber,
      customerId: entity.customerId,
      vehicleId: entity.vehicleId,
      problemDescription: entity.problemDescription,
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

  /**
   * `position` vem do índice no array: é o que preserva a ordem em que os
   * itens foram adicionados quando eles voltarem do banco.
   */
  public static toPrismaServices(
    entity: ServiceOrderEntity,
  ): Prisma.ServiceOrderServiceCreateWithoutServiceOrderInput[] {
    return entity.services.map((item, position) => ({
      // Só o `connect`, sem o escalar serviceId: o Prisma rejeita receber os
      // dois, e é o connect que garante que o serviço existe no catálogo.
      service: { connect: { id: item.serviceId } },
      serviceName: item.serviceName,
      price: item.price,
      quantity: item.quantity,
      notes: item.notes,
      position,
    }));
  }

  public static toPrismaParts(
    entity: ServiceOrderEntity,
  ): Prisma.ServiceOrderPartCreateWithoutServiceOrderInput[] {
    return entity.parts.map((item, position) => ({
      part: { connect: { id: item.partId } },
      partName: item.partName,
      partCode: item.partCode,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      position,
    }));
  }

  public static toEntity(
    prisma: PrismaServiceOrderWithItems,
  ): ServiceOrderEntity {
    return ServiceOrderEntity.reconstitute(
      {
        orderNumber: prisma.orderNumber,
        customerId: prisma.customerId,
        vehicleId: prisma.vehicleId,
        problemDescription: prisma.problemDescription,
        services: prisma.services.map(
          (item): ServiceItem => ({
            serviceId: item.serviceId,
            serviceName: item.serviceName,
            price: item.price.toNumber(),
            quantity: item.quantity,
            notes: item.notes ?? undefined,
          }),
        ),
        parts: prisma.parts.map((item): PartItem => {
          const unitPrice = item.unitPrice.toNumber();
          return {
            partId: item.partId,
            partName: item.partName,
            partCode: item.partCode,
            unitPrice,
            quantity: item.quantity,
            // Derivado, não persistido: guardar o produto de duas colunas da
            // mesma linha abriria espaço para os três valores divergirem.
            totalPrice: Math.round(unitPrice * item.quantity * 100) / 100,
          };
        }),
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
