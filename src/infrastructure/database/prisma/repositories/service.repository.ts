import { PrismaServiceMapper } from '../mappers/prisma-service.mapper';
import { IServiceRepository } from '@domain/repositories/service.repository.interface';
import { PrismaService } from '../prisma.service';
import { ServiceEntity } from '@domain/entities/service/service.entity';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ServiceRepository implements IServiceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(service: ServiceEntity): Promise<ServiceEntity> {
    const data = PrismaServiceMapper.toPrisma(service);
    const created = await this.prisma.service.create({ data });
    return PrismaServiceMapper.toEntity(created);
  }

  async findById(id: string): Promise<ServiceEntity | null> {
    const data = await this.prisma.service.findUnique({ where: { id } });
    return data ? PrismaServiceMapper.toEntity(data) : null;
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    onlyActive?: boolean;
  }): Promise<{ data: ServiceEntity[]; total: number }> {
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
    return {
      data: records.map((item) => PrismaServiceMapper.toEntity(item)),
      total,
    };
  }

  async update(service: ServiceEntity): Promise<ServiceEntity> {
    const data = PrismaServiceMapper.toPrisma(service);
    const updated = await this.prisma.service.update({
      where: { id: data.id },
      data,
    });
    return PrismaServiceMapper.toEntity(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.service.delete({ where: { id } });
  }
}
