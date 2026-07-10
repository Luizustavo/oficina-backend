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
    const where = params.status ? { status: params.status } : {};
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
