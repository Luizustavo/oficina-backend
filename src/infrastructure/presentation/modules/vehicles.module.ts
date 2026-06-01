import {
  ListVehiclesByCustomerUseCase,
  CreateVehicleUseCase,
  UpdateVehicleUseCase,
  DeleteVehicleUseCase,
  ListVehiclesUseCase,
  GetVehicleUseCase,
} from '@application/use-cases/vehicle/vehicle.use-cases';
import { CUSTOMER_REPOSITORY } from '@domain/repositories/customer.repository.interface';
import { CustomerRepository } from '@infrastructure/database/prisma/repositories/customer.repository';
import { VEHICLE_REPOSITORY } from '@domain/repositories/vehicle.repository.interface';
import { VehiclesController } from '../controllers/vehicles.controller';
import { VehicleRepository } from '@infrastructure/database/prisma/repositories/vehicle.repository';
import { Module } from '@nestjs/common';

@Module({
  controllers: [VehiclesController],
  providers: [
    ListVehiclesByCustomerUseCase,
    UpdateVehicleUseCase,
    DeleteVehicleUseCase,
    CreateVehicleUseCase,
    ListVehiclesUseCase,
    GetVehicleUseCase,
    { provide: CUSTOMER_REPOSITORY, useClass: CustomerRepository },
    { provide: VEHICLE_REPOSITORY, useClass: VehicleRepository },
  ],
  exports: [{ provide: VEHICLE_REPOSITORY, useClass: VehicleRepository }],
})
export class VehiclesModule {}
