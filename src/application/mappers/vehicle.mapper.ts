import { VehicleResponseDto } from '@application/dtos/response/vehicle.dto';
import { VehicleEntity } from '@domain/entities/vehicle/vehicle.entity';

export class VehicleMapper {
  private constructor() {
    throw new Error(
      'VehicleMapper is a static class and cannot be instantiated',
    );
  }

  public static toResponse(vehicle: VehicleEntity): VehicleResponseDto {
    return {
      id: vehicle.id,
      customerId: vehicle.customerId,
      licensePlate: vehicle.licensePlate,
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      color: vehicle.color,
      createdAt: vehicle.createdAt,
      updatedAt: vehicle.updatedAt,
    };
  }
}
