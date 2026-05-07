import { Module } from '@nestjs/common';
import { VehiclesController } from '../controllers/vehicles.controller';
import {
  CreateVehicleUseCase,
  GetVehicleUseCase,
  ListVehiclesUseCase,
  ListVehiclesByCustomerUseCase,
  UpdateVehicleUseCase,
  DeleteVehicleUseCase,
} from '../../../application/use-cases/vehicle/vehicle.use-cases';
import { VehicleRepository } from '../../database/repositories/vehicle.repository';
import { CustomerRepository } from '../../database/repositories/customer.repository';
import { VEHICLE_REPOSITORY } from '../../../domain/vehicle/vehicle.repository.interface';
import { CUSTOMER_REPOSITORY } from '../../../domain/customer/customer.repository.interface';

@Module({
  controllers: [VehiclesController],
  providers: [
    CreateVehicleUseCase,
    GetVehicleUseCase,
    ListVehiclesUseCase,
    ListVehiclesByCustomerUseCase,
    UpdateVehicleUseCase,
    DeleteVehicleUseCase,
    { provide: VEHICLE_REPOSITORY, useClass: VehicleRepository },
    { provide: CUSTOMER_REPOSITORY, useClass: CustomerRepository },
  ],
  exports: [{ provide: VEHICLE_REPOSITORY, useClass: VehicleRepository }],
})
export class VehiclesModule {}
