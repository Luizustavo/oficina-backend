import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IPartRepository } from '../../../domain/part/part.repository.interface';
import { Part } from '../../../domain/part/part.entity';

@Injectable()
export class PartRepository implements IPartRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(part: Part): Promise<Part> {
    const data = await this.prisma.part.create({
      data: {
        id: part.id,
        name: part.name,
        code: part.code,
        description: part.description,
        price: part.price,
        stockQuantity: part.stockQuantity,
        minStockQuantity: part.minStockQuantity,
        isActive: part.isActive,
      },
    });
    return this.toDomain(data);
  }

  async findById(id: string): Promise<Part | null> {
    const data = await this.prisma.part.findUnique({ where: { id } });
    return data ? this.toDomain(data) : null;
  }

  async findByCode(code: string): Promise<Part | null> {
    const data = await this.prisma.part.findUnique({ where: { code } });
    return data ? this.toDomain(data) : null;
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    onlyActive?: boolean;
  }): Promise<{ data: Part[]; total: number }> {
    const where = params.onlyActive ? { isActive: true } : {};
    const [records, total] = await Promise.all([
      this.prisma.part.findMany({
        where,
        skip: params.skip ?? 0,
        take: params.take ?? 20,
        orderBy: { name: 'asc' },
      }),
      this.prisma.part.count({ where }),
    ]);
    return {
      data: records.map((r: Parameters<PartRepository['toDomain']>[0]) =>
        this.toDomain(r),
      ),
      total,
    };
  }

  async findLowStock(): Promise<Part[]> {
    const records = await this.prisma.part.findMany({
      where: {
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });
    return records
      .map((r: any) => this.toDomain(r))
      .filter((part: Part) => part.isLowStock);
  }

  async update(part: Part): Promise<Part> {
    const data = await this.prisma.part.update({
      where: { id: part.id },
      data: {
        name: part.name,
        description: part.description,
        price: part.price,
        stockQuantity: part.stockQuantity,
        minStockQuantity: part.minStockQuantity,
        isActive: part.isActive,
        updatedAt: part.updatedAt,
      },
    });
    return this.toDomain(data);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.part.delete({ where: { id } });
  }

  private toDomain(data: {
    id: string;
    name: string;
    code: string;
    description: string | null;
    price: unknown;
    stockQuantity: number;
    minStockQuantity: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Part {
    return Part.reconstitute({
      id: data.id,
      name: data.name,
      code: data.code,
      description: data.description ?? undefined,
      price: Number(data.price),
      stockQuantity: data.stockQuantity,
      minStockQuantity: data.minStockQuantity,
      isActive: data.isActive,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }
}
