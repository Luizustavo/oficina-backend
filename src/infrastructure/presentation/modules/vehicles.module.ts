import {
  ListVehiclesByCustomerUseCase,
  CreateVehicleUseCase,
  UpdateVehicleUseCase,
  DeleteVehicleUseCase,
  ListVehiclesUseCase,
  GetVehicleUseCase,
} from '@application/use-cases/vehicle/vehicle.use-cases';
import { ICustomerRepository } from '@domain/repositories/customer.repository.interface';
import { IVehicleRepository } from '@domain/repositories/vehicle.repository.interface';
import { CustomerRepository } from '@infrastructure/database/prisma/repositories/customer.repository';
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
    { provide: ICustomerRepository, useClass: CustomerRepository },
    { provide: IVehicleRepository, useClass: VehicleRepository },
  ],
  exports: [{ provide: IVehicleRepository, useClass: VehicleRepository }],
})
export class VehiclesModule {}
