import { Prisma, Vehicle as PrismaVehicle } from '@generated/prisma/client';
import { VehicleEntity } from '@domain/entities/vehicle/vehicle.entity';

export class PrismaVehicleMapper {
  private constructor() {
    throw new Error(
      'PrismaVehicleMapper is a static class and cannot be instantiated.',
    );
  }

  public static toPrisma(
    entity: VehicleEntity,
  ): Prisma.VehicleUncheckedCreateInput {
    return {
      id: entity.id,
      customerId: entity.customerId,
      brand: entity.brand,
      model: entity.model,
      year: entity.year,
      color: entity.color,
      licensePlate: entity.licensePlate,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  public static toEntity(prisma: PrismaVehicle): VehicleEntity {
    return VehicleEntity.reconstitute(
      {
        customerId: prisma.customerId,
        brand: prisma.brand,
        model: prisma.model,
        year: prisma.year,
        color: prisma.color || undefined,
        licensePlate: prisma.licensePlate,
        createdAt: prisma.createdAt,
        updatedAt: prisma.updatedAt,
      },
      prisma.id,
    );
  }
}
