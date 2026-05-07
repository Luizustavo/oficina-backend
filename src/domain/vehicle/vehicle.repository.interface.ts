import { Vehicle } from './vehicle.entity';

export interface IVehicleRepository {
  create(vehicle: Vehicle): Promise<Vehicle>;
  findById(id: string): Promise<Vehicle | null>;
  findByLicensePlate(plate: string): Promise<Vehicle | null>;
  findByCustomerId(customerId: string): Promise<Vehicle[]>;
  findAll(params: {
    skip?: number;
    take?: number;
  }): Promise<{ data: Vehicle[]; total: number }>;
  update(vehicle: Vehicle): Promise<Vehicle>;
  delete(id: string): Promise<void>;
  hasServiceOrders(id: string): Promise<boolean>;
}

export const VEHICLE_REPOSITORY = Symbol('IVehicleRepository');
