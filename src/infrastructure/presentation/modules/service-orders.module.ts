import { Module } from '@nestjs/common';
import { ServiceOrdersController } from '../controllers/service-orders.controller';
import {
  ListServiceOrdersByCustomerUseCase,
  ListServiceOrdersByStatusUseCase,
  GetAverageExecutionTimeUseCase,
  CreateServiceOrderUseCase,
  ListServiceOrdersUseCase,
  TrackServiceOrderUseCase,
  AddServiceToOrderUseCase,
  RequestApprovalUseCase,
  GetServiceOrderUseCase,
  AddPartToOrderUseCase,
  StartDiagnosisUseCase,
  CompleteOrderUseCase,
  ApproveOrderUseCase,
  DeliverOrderUseCase,
  CancelOrderUseCase,
} from '@application/use-cases/service-order/service-order.use-cases';
import { IServiceOrderRepository } from '@domain/repositories/service-order.repository.interface';
import { ServiceOrderRepository } from '@infrastructure/database/prisma/repositories/service-order.repository';
import { ICustomerRepository } from '@domain/repositories/customer.repository.interface';
import { CustomerRepository } from '@infrastructure/database/prisma/repositories/customer.repository';
import { IVehicleRepository } from '@domain/repositories/vehicle.repository.interface';
import { IServiceRepository } from '@domain/repositories/service.repository.interface';
import { VehicleRepository } from '@infrastructure/database/prisma/repositories/vehicle.repository';
import { ServiceRepository } from '@infrastructure/database/prisma/repositories/service.repository';
import { IPartRepository } from '@domain/repositories/part.repository.interface';
import { PartRepository } from '@infrastructure/database/prisma/repositories/part.repository';

@Module({
  controllers: [ServiceOrdersController],
  providers: [
    ListServiceOrdersByCustomerUseCase,
    ListServiceOrdersByStatusUseCase,
    GetAverageExecutionTimeUseCase,
    CreateServiceOrderUseCase,
    ListServiceOrdersUseCase,
    TrackServiceOrderUseCase,
    AddServiceToOrderUseCase,
    RequestApprovalUseCase,
    GetServiceOrderUseCase,
    AddPartToOrderUseCase,
    StartDiagnosisUseCase,
    CompleteOrderUseCase,
    ApproveOrderUseCase,
    DeliverOrderUseCase,
    CancelOrderUseCase,
    { provide: IServiceOrderRepository, useClass: ServiceOrderRepository },
    { provide: ICustomerRepository, useClass: CustomerRepository },
    { provide: IVehicleRepository, useClass: VehicleRepository },
    { provide: IServiceRepository, useClass: ServiceRepository },
    { provide: IPartRepository, useClass: PartRepository },
  ],
})
export class ServiceOrdersModule {}
