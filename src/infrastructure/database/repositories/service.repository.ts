import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IServiceRepository } from '../../../domain/service/service.repository.interface';
import { Service } from '../../../domain/service/service.entity';

@Injectable()
export class ServiceRepository implements IServiceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(service: Service): Promise<Service> {
    const data = await this.prisma.service.create({
      data: {
        id: service.id,
        name: service.name,
        description: service.description,
        price: service.price,
        estimatedDurationMinutes: service.estimatedDurationMinutes,
        isActive: service.isActive,
      },
    });
    return this.toDomain(data);
  }

  async findById(id: string): Promise<Service | null> {
    const data = await this.prisma.service.findUnique({ where: { id } });
    return data ? this.toDomain(data) : null;
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    onlyActive?: boolean;
  }): Promise<{ data: Service[]; total: number }> {
    const where = params.onlyActive ? { isActive: true } : {};
    const [records, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        skip: params.skip ?? 0,
        take: params.take ?? 20,
        orderBy: { name: 'asc' },
      }),
      this.prisma.service.count({ where }),
    ]);
    return { data: records.map((r: any) => this.toDomain(r)), total };
  }

  async update(service: Service): Promise<Service> {
    const data = await this.prisma.service.update({
      where: { id: service.id },
      data: {
        name: service.name,
        description: service.description,
        price: service.price,
        estimatedDurationMinutes: service.estimatedDurationMinutes,
        isActive: service.isActive,
        updatedAt: service.updatedAt,
      },
    });
    return this.toDomain(data);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.service.delete({ where: { id } });
  }

  private toDomain(data: {
    id: string;
    name: string;
    description: string | null;
    price: unknown;
    estimatedDurationMinutes: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Service {
    return Service.reconstitute({
      id: data.id,
      name: data.name,
      description: data.description ?? undefined,
      price: Number(data.price),
      estimatedDurationMinutes: data.estimatedDurationMinutes,
      isActive: data.isActive,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }
}
