import { Module } from '@nestjs/common';
import { ServiceOrdersController } from '../controllers/service-orders.controller';
import {
  CreateServiceOrderUseCase,
  GetServiceOrderUseCase,
  ListServiceOrdersUseCase,
  ListServiceOrdersByCustomerUseCase,
  ListServiceOrdersByStatusUseCase,
  AddServiceToOrderUseCase,
  AddPartToOrderUseCase,
  StartDiagnosisUseCase,
  RequestApprovalUseCase,
  ApproveOrderUseCase,
  CompleteOrderUseCase,
  DeliverOrderUseCase,
  CancelOrderUseCase,
  TrackServiceOrderUseCase,
  GetAverageExecutionTimeUseCase,
} from '../../../application/use-cases/service-order/service-order.use-cases';
import { ServiceOrderRepository } from '../../database/repositories/service-order.repository';
import { CustomerRepository } from '../../database/repositories/customer.repository';
import { VehicleRepository } from '../../database/repositories/vehicle.repository';
import { ServiceRepository } from '../../database/repositories/service.repository';
import { PartRepository } from '../../database/repositories/part.repository';
import { SERVICE_ORDER_REPOSITORY } from '../../../domain/service-order/service-order.repository.interface';
import { CUSTOMER_REPOSITORY } from '../../../domain/customer/customer.repository.interface';
import { VEHICLE_REPOSITORY } from '../../../domain/vehicle/vehicle.repository.interface';
import { SERVICE_REPOSITORY } from '../../../domain/service/service.repository.interface';
import { PART_REPOSITORY } from '../../../domain/part/part.repository.interface';

@Module({
  controllers: [ServiceOrdersController],
  providers: [
    CreateServiceOrderUseCase,
    GetServiceOrderUseCase,
    ListServiceOrdersUseCase,
    ListServiceOrdersByCustomerUseCase,
    ListServiceOrdersByStatusUseCase,
    AddServiceToOrderUseCase,
    AddPartToOrderUseCase,
    StartDiagnosisUseCase,
    RequestApprovalUseCase,
    ApproveOrderUseCase,
    CompleteOrderUseCase,
    DeliverOrderUseCase,
    CancelOrderUseCase,
    TrackServiceOrderUseCase,
    GetAverageExecutionTimeUseCase,
    { provide: SERVICE_ORDER_REPOSITORY, useClass: ServiceOrderRepository },
    { provide: CUSTOMER_REPOSITORY, useClass: CustomerRepository },
    { provide: VEHICLE_REPOSITORY, useClass: VehicleRepository },
    { provide: SERVICE_REPOSITORY, useClass: ServiceRepository },
    { provide: PART_REPOSITORY, useClass: PartRepository },
  ],
})
export class ServiceOrdersModule {}
