import { ListVehiclesByCustomerUseCase } from '@application/use-cases/vehicle/list-vehicles-by-customer.use-case';
import { CreateVehicleUseCase } from '@application/use-cases/vehicle/create-vehicle.use-case';
import { UpdateVehicleUseCase } from '@application/use-cases/vehicle/update-vehicle.use-case';
import { DeleteVehicleUseCase } from '@application/use-cases/vehicle/delete-vehicle.use-case';
import { ListVehiclesUseCase } from '@application/use-cases/vehicle/list-vehicles.use-case';
import { ICustomerRepository } from '@domain/repositories/customer.repository.interface';
import { IVehicleRepository } from '@domain/repositories/vehicle.repository.interface';
import { CustomerRepository } from '@infrastructure/database/prisma/repositories/customer.repository';
import { VehiclesController } from '../controllers/vehicles.controller';
import { GetVehicleUseCase } from '@application/use-cases/vehicle/get-vehicle.use-case';
import { VehicleRepository } from '@infrastructure/database/prisma/repositories/vehicle.repository';
import { Logger, Module } from '@nestjs/common';

@Module({
  controllers: [VehiclesController],
  providers: [
    Logger,
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
