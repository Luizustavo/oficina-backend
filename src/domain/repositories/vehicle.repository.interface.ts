import { VehicleEntity } from '../entities/vehicle/vehicle.entity';

export interface IVehicleRepository {
  create(vehicle: VehicleEntity): Promise<VehicleEntity>;
  findById(id: string): Promise<VehicleEntity | null>;
  findByLicensePlate(plate: string): Promise<VehicleEntity | null>;
  findByCustomerId(customerId: string): Promise<VehicleEntity[]>;
  findAll(params: {
    skip?: number;
    take?: number;
  }): Promise<{ data: VehicleEntity[]; total: number }>;
  update(vehicle: VehicleEntity): Promise<VehicleEntity>;
  delete(id: string): Promise<void>;
  hasServiceOrders(id: string): Promise<boolean>;
}

export const VEHICLE_REPOSITORY = Symbol('IVehicleRepository');
