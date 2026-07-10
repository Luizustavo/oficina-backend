import { VehicleEntity } from '@domain/entities/vehicle/vehicle.entity';

export abstract class IVehicleRepository {
  abstract findByLicensePlate(plate: string): Promise<VehicleEntity | null>;
  abstract findByCustomerId(customerId: string): Promise<VehicleEntity[]>;
  abstract hasServiceOrders(id: string): Promise<boolean>;
  abstract findById(id: string): Promise<VehicleEntity | null>;
  abstract create(vehicle: VehicleEntity): Promise<VehicleEntity>;
  abstract update(vehicle: VehicleEntity): Promise<VehicleEntity>;
  abstract delete(id: string): Promise<void>;
  abstract findAll(params: {
    skip?: number;
    take?: number;
  }): Promise<{ data: VehicleEntity[]; total: number }>;
}
