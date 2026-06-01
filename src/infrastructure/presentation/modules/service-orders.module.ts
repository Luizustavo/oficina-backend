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
import { SERVICE_ORDER_REPOSITORY } from '@domain/repositories/service-order.repository.interface';
import { ServiceOrderRepository } from '@infrastructure/database/prisma/repositories/service-order.repository';
import { CUSTOMER_REPOSITORY } from '@domain/repositories/customer.repository.interface';
import { CustomerRepository } from '@infrastructure/database/prisma/repositories/customer.repository';
import { VEHICLE_REPOSITORY } from '@domain/repositories/vehicle.repository.interface';
import { SERVICE_REPOSITORY } from '@domain/repositories/service.repository.interface';
import { VehicleRepository } from '@infrastructure/database/prisma/repositories/vehicle.repository';
import { ServiceRepository } from '@infrastructure/database/prisma/repositories/service.repository';
import { PART_REPOSITORY } from '@domain/repositories/part.repository.interface';
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
    { provide: SERVICE_ORDER_REPOSITORY, useClass: ServiceOrderRepository },
    { provide: CUSTOMER_REPOSITORY, useClass: CustomerRepository },
    { provide: VEHICLE_REPOSITORY, useClass: VehicleRepository },
    { provide: SERVICE_REPOSITORY, useClass: ServiceRepository },
    { provide: PART_REPOSITORY, useClass: PartRepository },
  ],
})
export class ServiceOrdersModule {}
