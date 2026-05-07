import { Injectable } from '@nestjs/common';
import { Prisma } from '@generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IServiceOrderRepository } from '../../../domain/service-order/service-order.repository.interface';
import { ServiceOrder } from '../../../domain/service-order/service-order.entity';
import { ServiceOrderStatus } from '../../../domain/value-objects/service-order-status.value-object';
import {
  ServiceItem,
  PartItem,
} from '../../../domain/service-order/service-order-items.value-object';

@Injectable()
export class ServiceOrderRepository implements IServiceOrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(order: ServiceOrder): Promise<ServiceOrder> {
    const data = await this.prisma.serviceOrder.create({
      data: {
        id: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        vehicleId: order.vehicleId,
        problemDescription: order.problemDescription,
        status: order.status,
        services: order.services as unknown as Prisma.InputJsonValue,
        parts: order.parts as unknown as Prisma.InputJsonValue,
        totalAmount: order.totalAmount,
        notes: order.notes,
        approvedAt: order.approvedAt,
        startedAt: order.startedAt,
        finishedAt: order.finishedAt,
        deliveredAt: order.deliveredAt,
      },
    });
    return this.toDomain(data);
  }

  async findById(id: string): Promise<ServiceOrder | null> {
    const data = await this.prisma.serviceOrder.findUnique({ where: { id } });
    return data ? this.toDomain(data) : null;
  }

  async findByOrderNumber(orderNumber: string): Promise<ServiceOrder | null> {
    const data = await this.prisma.serviceOrder.findUnique({
      where: { orderNumber },
    });
    return data ? this.toDomain(data) : null;
  }

  async findByCustomerId(customerId: string): Promise<ServiceOrder[]> {
    const records = await this.prisma.serviceOrder.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r: any) => this.toDomain(r));
  }

  async findByStatus(status: ServiceOrderStatus): Promise<ServiceOrder[]> {
    const records = await this.prisma.serviceOrder.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r: any) => this.toDomain(r));
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    status?: ServiceOrderStatus;
  }): Promise<{ data: ServiceOrder[]; total: number }> {
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
    return { data: records.map((r: any) => this.toDomain(r)), total };
  }

  async findAllCompleted(): Promise<ServiceOrder[]> {
    const records = await this.prisma.serviceOrder.findMany({
      where: {
        status: { in: ['COMPLETED', 'DELIVERED'] },
        startedAt: { not: null },
        finishedAt: { not: null },
      },
      orderBy: { finishedAt: 'desc' },
    });
    return records.map((r: any) => this.toDomain(r));
  }

  async update(order: ServiceOrder): Promise<ServiceOrder> {
    const data = await this.prisma.serviceOrder.update({
      where: { id: order.id },
      data: {
        status: order.status,
        services: order.services as unknown as Prisma.InputJsonValue,
        parts: order.parts as unknown as Prisma.InputJsonValue,
        totalAmount: order.totalAmount,
        notes: order.notes,
        approvedAt: order.approvedAt,
        startedAt: order.startedAt,
        finishedAt: order.finishedAt,
        deliveredAt: order.deliveredAt,
        updatedAt: order.updatedAt,
      },
    });
    return this.toDomain(data);
  }

  private toDomain(data: {
    id: string;
    orderNumber: string;
    customerId: string;
    vehicleId: string;
    problemDescription: string;
    status: string;
    services: unknown;
    parts: unknown;
    totalAmount: unknown;
    notes: string | null;
    approvedAt: Date | null;
    startedAt: Date | null;
    finishedAt: Date | null;
    deliveredAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): ServiceOrder {
    return ServiceOrder.reconstitute({
      id: data.id,
      orderNumber: data.orderNumber,
      customerId: data.customerId,
      vehicleId: data.vehicleId,
      problemDescription: data.problemDescription,
      status: data.status as ServiceOrderStatus,
      services: (data.services as ServiceItem[]) ?? [],
      parts: (data.parts as PartItem[]) ?? [],
      totalAmount: Number(data.totalAmount),
      notes: data.notes ?? undefined,
      approvedAt: data.approvedAt ?? undefined,
      startedAt: data.startedAt ?? undefined,
      finishedAt: data.finishedAt ?? undefined,
      deliveredAt: data.deliveredAt ?? undefined,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }
}
