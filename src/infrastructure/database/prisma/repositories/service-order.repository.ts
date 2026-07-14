import {
  SERVICE_ORDER_LIST_EXCLUDED_STATUSES,
  SERVICE_ORDER_LIST_STATUS_PRIORITY,
} from '@domain/validators/value-objects/service-order-status.value-object';
import { ServiceOrder as PrismaServiceOrder } from '@generated/prisma/client';
import { PrismaServiceOrderMapper } from '@infrastructure/database/prisma/mappers/prisma-service-order.mapper';
import { IServiceOrderRepository } from '@domain/repositories/service-order.repository.interface';
import { ServiceOrderEntity } from '@domain/entities/service-order/service-order.entity';
import { ServiceOrderStatus } from '@generated/prisma/enums';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ServiceOrderRepository implements IServiceOrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(order: ServiceOrderEntity): Promise<ServiceOrderEntity> {
    const data = PrismaServiceOrderMapper.toPrisma(order);
    const created = await this.prisma.serviceOrder.create({ data });
    return PrismaServiceOrderMapper.toEntity(created);
  }

  async findById(id: string): Promise<ServiceOrderEntity | null> {
    const data = await this.prisma.serviceOrder.findUnique({ where: { id } });
    return data ? PrismaServiceOrderMapper.toEntity(data) : null;
  }

  async findByOrderNumber(
    orderNumber: string,
  ): Promise<ServiceOrderEntity | null> {
    const data = await this.prisma.serviceOrder.findUnique({
      where: { orderNumber },
    });

    return data ? PrismaServiceOrderMapper.toEntity(data) : null;
  }

  async findByCustomerId(customerId: string): Promise<ServiceOrderEntity[]> {
    const records = await this.prisma.serviceOrder.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((item) => PrismaServiceOrderMapper.toEntity(item));
  }

  async findByStatus(
    status: ServiceOrderStatus,
  ): Promise<ServiceOrderEntity[]> {
    const records = await this.prisma.serviceOrder.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
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
    const records: PrismaServiceOrder[] = [];

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
    });
    return records.map((item) => PrismaServiceOrderMapper.toEntity(item));
  }

  async update(order: ServiceOrderEntity): Promise<ServiceOrderEntity> {
    const data = PrismaServiceOrderMapper.toPrisma(order);
    const updated = await this.prisma.serviceOrder.update({
      where: { id: data.id },
      data,
    });
    return PrismaServiceOrderMapper.toEntity(updated);
  }
}
