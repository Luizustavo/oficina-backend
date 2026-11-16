import { ListServiceOrdersByCustomerUseCase } from '@application/use-cases/service-order/list-service-orders-by-customer.use-case';
import { ListServiceOrdersByStatusUseCase } from '@application/use-cases/service-order/list-service-orders-by-status.use-case';
import { GetAverageExecutionTimeUseCase } from '@application/use-cases/service-order/get-average-execution-time.use-case';
import { ResendEmailNotificationService } from '@infrastructure/notification/resend-email-notification.service';
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
import { DeliverOrderUseCase } from '@application/use-cases/service-order/deliver-order.use-case';
import { ICustomerRepository } from '@domain/repositories/customer.repository.interface';
import { CancelOrderUseCase } from '@application/use-cases/service-order/cancel-order.use-case';
import { CustomerRepository } from '@infrastructure/database/prisma/repositories/customer.repository';
import { IVehicleRepository } from '@domain/repositories/vehicle.repository.interface';
import { IServiceRepository } from '@domain/repositories/service.repository.interface';
import { VehicleRepository } from '@infrastructure/database/prisma/repositories/vehicle.repository';
import { ServiceRepository } from '@infrastructure/database/prisma/repositories/service.repository';
import { IPartRepository } from '@domain/repositories/part.repository.interface';
import { ServiceOrderMetrics } from '@infrastructure/observability/service-order.metrics';
import { IntegrationMetrics } from '@infrastructure/observability/integration.metrics';
import { ProcessSagaEventUseCase } from '@application/use-cases/saga/process-saga-event.use-case';
import { PrismaTransactionManager } from '@infrastructure/database/prisma/prisma-transaction-manager';
import { SagaRepository } from '@infrastructure/database/prisma/repositories/saga.repository';
import { ITransactionManager } from '@domain/services/transaction-manager.interface';
import { ISagaRepository } from '@domain/repositories/saga.repository.interface';
import { SagaEventHandlers } from '@infrastructure/messaging/saga-event-handlers';
import { sagaConfig } from '@infrastructure/config/saga.config';
import { SagaSettings } from '@application/saga/saga-settings';
import { Logger, Module } from '@nestjs/common';
import { PartRepository } from '@infrastructure/database/prisma/repositories/part.repository';

@Module({
  controllers: [ServiceOrdersController],
  providers: [
    Logger,
    ServiceOrderMetrics,
    IntegrationMetrics,
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
    DeliverOrderUseCase,
    CancelOrderUseCase,
    // Saga orquestrada (ADR-011): processa os eventos do Billing e do
    // Execution que chegam pela fila os.saga-events.
    ProcessSagaEventUseCase,
    SagaEventHandlers,
    { provide: SagaSettings, useFactory: () => sagaConfig().saga },
    { provide: ITransactionManager, useClass: PrismaTransactionManager },
    { provide: ISagaRepository, useClass: SagaRepository },
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
  // Exportado para o CustomerScopeGuard, que é global (registrado no
  // AppModule) e precisa carregar a ordem para conferir o dono.
  exports: [IServiceOrderRepository],
})
export class ServiceOrdersModule {}
