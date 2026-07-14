import { ListServiceOrdersByCustomerUseCase } from '@application/use-cases/service-order/list-service-orders-by-customer.use-case';
import { ListServiceOrdersByStatusUseCase } from '@application/use-cases/service-order/list-service-orders-by-status.use-case';
import { GetAverageExecutionTimeUseCase } from '@application/use-cases/service-order/get-average-execution-time.use-case';
import { ResendEmailNotificationService } from '@infrastructure/notification/resend-email-notification.service';
import { ProcessBudgetDecisionUseCase } from '@application/use-cases/service-order/process-budget-decision.use-case';
import { CreateServiceOrderUseCase } from '@application/use-cases/service-order/create-service-order.use-case';
import { IEmailNotificationService } from '@domain/services/email-notification.service.interface';
import { ListServiceOrdersUseCase } from '@application/use-cases/service-order/list-service-orders.use-case';
import { TrackServiceOrderUseCase } from '@application/use-cases/service-order/track-service-order.use-case';
import { AddServiceToOrderUseCase } from '@application/use-cases/service-order/add-service-to-order.use-case';
import { ServiceOrdersController } from '@infrastructure/presentation/controllers/service-orders.controller';
import { IServiceOrderRepository } from '@domain/repositories/service-order.repository.interface';
import { RequestApprovalUseCase } from '@application/use-cases/service-order/request-approval.use-case';
import { GetServiceOrderUseCase } from '@application/use-cases/service-order/get-service-order.use-case';
import { ServiceOrderRepository } from '@infrastructure/database/prisma/repositories/service-order.repository';
import { AddPartToOrderUseCase } from '@application/use-cases/service-order/add-part-to-order.use-case';
import { StartDiagnosisUseCase } from '@application/use-cases/service-order/start-diagnosis.use-case';
import { CompleteOrderUseCase } from '@application/use-cases/service-order/complete-order.use-case';
import { ApproveOrderUseCase } from '@application/use-cases/service-order/approve-order.use-case';
import { DeliverOrderUseCase } from '@application/use-cases/service-order/deliver-order.use-case';
import { ICustomerRepository } from '@domain/repositories/customer.repository.interface';
import { CancelOrderUseCase } from '@application/use-cases/service-order/cancel-order.use-case';
import { CustomerRepository } from '@infrastructure/database/prisma/repositories/customer.repository';
import { IVehicleRepository } from '@domain/repositories/vehicle.repository.interface';
import { IServiceRepository } from '@domain/repositories/service.repository.interface';
import { VehicleRepository } from '@infrastructure/database/prisma/repositories/vehicle.repository';
import { ServiceRepository } from '@infrastructure/database/prisma/repositories/service.repository';
import { IPartRepository } from '@domain/repositories/part.repository.interface';
import { Logger, Module } from '@nestjs/common';
import { PartRepository } from '@infrastructure/database/prisma/repositories/part.repository';

@Module({
  controllers: [ServiceOrdersController],
  providers: [
    Logger,
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
    ProcessBudgetDecisionUseCase,
    { provide: IServiceOrderRepository, useClass: ServiceOrderRepository },
    { provide: ICustomerRepository, useClass: CustomerRepository },
    { provide: IVehicleRepository, useClass: VehicleRepository },
    { provide: IServiceRepository, useClass: ServiceRepository },
    { provide: IPartRepository, useClass: PartRepository },
    {
      provide: IEmailNotificationService,
      useClass: ResendEmailNotificationService,
    },
  ],
})
export class ServiceOrdersModule {}
