import {
  SERVICE_ORDER_LIST_EXCLUDED_STATUSES,
  SERVICE_ORDER_LIST_STATUS_PRIORITY,
} from '@domain/validators/value-objects/service-order-status.value-object';
import {
  PrismaServiceOrderWithItems,
  PrismaServiceOrderMapper,
} from '@infrastructure/database/prisma/mappers/prisma-service-order.mapper';
import { IServiceOrderRepository } from '@domain/repositories/service-order.repository.interface';
import { ServiceOrderEntity } from '@domain/entities/service-order/service-order.entity';
import { ServiceOrderStatus } from '@generated/prisma/enums';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';

// Itens sempre vêm junto: sem eles a entidade não consegue recalcular o
// total nem responder pelo que foi orçado.
const WITH_ITEMS = {
  services: { orderBy: { position: 'asc' } },
  parts: { orderBy: { position: 'asc' } },
} as const;

@Injectable()
export class ServiceOrderRepository implements IServiceOrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(order: ServiceOrderEntity): Promise<ServiceOrderEntity> {
    const created = await this.prisma.serviceOrder.create({
      data: {
        ...PrismaServiceOrderMapper.toPrisma(order),
        services: { create: PrismaServiceOrderMapper.toPrismaServices(order) },
        parts: { create: PrismaServiceOrderMapper.toPrismaParts(order) },
      },
      include: WITH_ITEMS,
    });
    return PrismaServiceOrderMapper.toEntity(created);
  }

  async findById(id: string): Promise<ServiceOrderEntity | null> {
    const data = await this.prisma.serviceOrder.findUnique({
      where: { id },
      include: WITH_ITEMS,
    });
    return data ? PrismaServiceOrderMapper.toEntity(data) : null;
  }

  async findByOrderNumber(
    orderNumber: string,
  ): Promise<ServiceOrderEntity | null> {
    const data = await this.prisma.serviceOrder.findUnique({
      where: { orderNumber },
      include: WITH_ITEMS,
    });

    return data ? PrismaServiceOrderMapper.toEntity(data) : null;
  }

  async findByCustomerId(customerId: string): Promise<ServiceOrderEntity[]> {
    const records = await this.prisma.serviceOrder.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: WITH_ITEMS,
    });
    return records.map((item) => PrismaServiceOrderMapper.toEntity(item));
  }

  async findByStatus(
    status: ServiceOrderStatus,
  ): Promise<ServiceOrderEntity[]> {
    const records = await this.prisma.serviceOrder.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      include: WITH_ITEMS,
    });
    return records.map((item) => PrismaServiceOrderMapper.toEntity(item));
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    status?: ServiceOrderStatus;
  }): Promise<{ data: ServiceOrderEntity[]; total: number }> {
    if (params.status) {
      const where = { status: params.status };
      const [records, total] = await Promise.all([
        this.prisma.serviceOrder.findMany({
          where,
          skip: params.skip ?? 0,
          take: params.take ?? 20,
          orderBy: { createdAt: 'desc' },
          include: WITH_ITEMS,
        }),
        this.prisma.serviceOrder.count({ where }),
      ]);
      return {
        data: records.map((item) => PrismaServiceOrderMapper.toEntity(item)),
        total,
      };
    }

    return this.findAllOrderedByListPriority(
      params.skip ?? 0,
      params.take ?? 20,
    );
  }

  private async findAllOrderedByListPriority(
    skip: number,
    take: number,
  ): Promise<{ data: ServiceOrderEntity[]; total: number }> {
    let remainingSkip = skip;
    let remainingTake = take;
    const records: PrismaServiceOrderWithItems[] = [];

    for (const status of SERVICE_ORDER_LIST_STATUS_PRIORITY) {
      if (remainingTake <= 0) break;

      const bucketCount = await this.prisma.serviceOrder.count({
        where: { status },
      });
      if (remainingSkip >= bucketCount) {
        remainingSkip -= bucketCount;
        continue;
      }

      const bucketRecords = await this.prisma.serviceOrder.findMany({
        where: { status },
        orderBy: { createdAt: 'asc' },
        skip: remainingSkip,
        take: remainingTake,
        include: WITH_ITEMS,
      });
      records.push(...bucketRecords);
      remainingTake -= bucketRecords.length;
      remainingSkip = 0;
    }

    const total = await this.prisma.serviceOrder.count({
      where: { status: { notIn: SERVICE_ORDER_LIST_EXCLUDED_STATUSES } },
    });

    return {
      data: records.map((item) => PrismaServiceOrderMapper.toEntity(item)),
      total,
    };
  }

  async findAllCompleted(): Promise<ServiceOrderEntity[]> {
    const records = await this.prisma.serviceOrder.findMany({
      where: {
        status: { in: ['COMPLETED', 'DELIVERED'] },
        startedAt: { not: null },
        finishedAt: { not: null },
      },
      orderBy: { finishedAt: 'desc' },
      include: WITH_ITEMS,
    });
    return records.map((item) => PrismaServiceOrderMapper.toEntity(item));
  }

  async update(order: ServiceOrderEntity): Promise<ServiceOrderEntity> {
    // A entidade trabalha com a lista inteira em memória, então a forma
    // correta de persistir é trocar os filhos por completo. O Prisma executa
    // o deleteMany e os creates aninhados numa única transação, então não
    // existe instante em que a ordem fique sem itens.
    const updated = await this.prisma.serviceOrder.update({
      where: { id: order.id },
      data: {
        ...PrismaServiceOrderMapper.toPrisma(order),
        services: {
          deleteMany: {},
          create: PrismaServiceOrderMapper.toPrismaServices(order),
        },
        parts: {
          deleteMany: {},
          create: PrismaServiceOrderMapper.toPrismaParts(order),
        },
      },
      include: WITH_ITEMS,
    });
    return PrismaServiceOrderMapper.toEntity(updated);
  }
}
