import { Prisma, Service as PrismaService } from '@generated/prisma/client';
import { ServiceEntity } from '@domain/entities/service/service.entity';

export class PrismaServiceMapper {
  private constructor() {
    throw new Error(
      'PrismaServiceMapper is a static class and cannot be instantiated.',
    );
  }

  public static toPrisma(entity: ServiceEntity): Prisma.ServiceCreateInput {
    return {
      id: entity.id,
      name: entity.name,
      description: entity.description,
      price: entity.price,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      estimatedDurationMinutes: entity.estimatedDurationMinutes,
      isActive: entity.isActive,
    };
  }

  public static toEntity(prisma: PrismaService): ServiceEntity {
    return ServiceEntity.reconstitute(
      {
        name: prisma.name,
        description: prisma.description || undefined,
        price: Number(prisma.price),
        createdAt: prisma.createdAt,
        updatedAt: prisma.updatedAt,
        estimatedDurationMinutes: prisma.estimatedDurationMinutes,
        isActive: prisma.isActive,
      },
      prisma.id,
    );
  }
}
