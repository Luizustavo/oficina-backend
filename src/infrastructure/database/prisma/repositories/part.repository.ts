import { PrismaPartMapper } from '../mappers/prisma-part.mapper';
import { IPartRepository } from '@domain/repositories/part.repository.interface';
import { PrismaService } from '../prisma.service';
import { Injectable } from '@nestjs/common';
import { PartEntity } from '@domain/entities/part/part.entity';

@Injectable()
export class PartRepository implements IPartRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(part: PartEntity): Promise<PartEntity> {
    const data = PrismaPartMapper.toPrisma(part);
    const created = await this.prisma.part.create({ data });
    return PrismaPartMapper.toEntity(created);
  }

  async findById(id: string): Promise<PartEntity | null> {
    const data = await this.prisma.part.findUnique({ where: { id } });
    return data ? PrismaPartMapper.toEntity(data) : null;
  }

  async findByCode(code: string): Promise<PartEntity | null> {
    const data = await this.prisma.part.findUnique({ where: { code } });
    return data ? PrismaPartMapper.toEntity(data) : null;
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    onlyActive?: boolean;
  }): Promise<{ data: PartEntity[]; total: number }> {
    const [records, total] = await Promise.all([
      this.prisma.part.findMany({
        skip: params.skip ?? 0,
        take: params.take ?? 20,
        where: {
          isActive: params.onlyActive ? true : undefined,
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.part.count({
        where: {
          isActive: params.onlyActive ? true : undefined,
        },
      }),
    ]);
    return {
      data: records.map((item) => PrismaPartMapper.toEntity(item)),
      total,
    };
  }

  async findLowStock(): Promise<PartEntity[]> {
    const records = await this.prisma.part.findMany({
      where: {
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });
    return records
      .map((item) => PrismaPartMapper.toEntity(item))
      .filter((part: PartEntity) => part.isLowStock);
  }

  async update(part: PartEntity): Promise<PartEntity> {
    const data = PrismaPartMapper.toPrisma(part);
    const updated = await this.prisma.part.update({
      where: { id: data.id },
      data,
    });
    return PrismaPartMapper.toEntity(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.part.delete({ where: { id } });
  }
}
