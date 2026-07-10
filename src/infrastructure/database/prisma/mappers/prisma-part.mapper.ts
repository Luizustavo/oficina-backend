import { Prisma, Part as PrismaPart } from '@generated/prisma/client';
import { PartEntity } from '@domain/entities/part/part.entity';

export class PrismaPartMapper {
  private constructor() {
    throw new Error(
      'PrismaPartMapper is a static class and cannot be instantiated.',
    );
  }

  public static toPrisma(entity: PartEntity): Prisma.PartCreateInput {
    return {
      id: entity.id,
      name: entity.name,
      code: entity.code,
      description: entity.description,
      price: entity.price,
      stockQuantity: entity.stockQuantity,
      minStockQuantity: entity.minStockQuantity,
      isActive: entity.isActive,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  public static toEntity(prisma: PrismaPart): PartEntity {
    return PartEntity.reconstitute(
      {
        code: prisma.code,
        name: prisma.name,
        description: prisma.description || undefined,
        price: Number(prisma.price),
        stockQuantity: prisma.stockQuantity,
        minStockQuantity: prisma.minStockQuantity,
        isActive: prisma.isActive,
        createdAt: prisma.createdAt,
        updatedAt: prisma.updatedAt,
      },
      prisma.id,
    );
  }
}
