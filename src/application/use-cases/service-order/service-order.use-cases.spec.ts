import {
  NotFoundException,
  InsufficientStockException,
  BusinessRuleException,
} from '@shared/exceptions/domain.exceptions';
import { ListServiceOrdersByCustomerUseCase } from './list-service-orders-by-customer.use-case';
import { ListServiceOrdersByStatusUseCase } from './list-service-orders-by-status.use-case';
import { GetAverageExecutionTimeUseCase } from './get-average-execution-time.use-case';
import { CreateServiceOrderUseCase } from './create-service-order.use-case';
import { IEmailNotificationService } from '@domain/services/email-notification.service.interface';
import { ListServiceOrdersUseCase } from './list-service-orders.use-case';
import { AddServiceToOrderUseCase } from './add-service-to-order.use-case';
import { TrackServiceOrderUseCase } from './track-service-order.use-case';
import { IServiceOrderRepository } from '@domain/repositories/service-order.repository.interface';
import { RequestApprovalUseCase } from './request-approval.use-case';
import { GetServiceOrderUseCase } from './get-service-order.use-case';
import { StartDiagnosisUseCase } from './start-diagnosis.use-case';
import { AddPartToOrderUseCase } from './add-part-to-order.use-case';
import { DeliverOrderUseCase } from './deliver-order.use-case';
import { ICustomerRepository } from '@domain/repositories/customer.repository.interface';
import { CancelOrderUseCase } from './cancel-order.use-case';
import { IVehicleRepository } from '@domain/repositories/vehicle.repository.interface';
import { ServiceOrderEntity } from '@domain/entities/service-order/service-order.entity';
import { ServiceOrderMetrics } from '@infrastructure/observability/service-order.metrics';
import { ServiceOrderStatus } from '@domain/validators/value-objects/service-order-status.value-object';
import { IPartRepository } from '@domain/repositories/part.repository.interface';
import { ProcessSagaEventUseCase } from '@application/use-cases/saga/process-saga-event.use-case';
import { SagaInstanceEntity } from '@domain/entities/saga/saga-instance.entity';
import { ITransactionManager } from '@domain/services/transaction-manager.interface';
import { ISagaRepository } from '@domain/repositories/saga.repository.interface';
import { SagaStatus, SagaStep } from '@domain/enums/saga.enum';
import { CustomerEntity } from '@domain/entities/customer/customer.entity';
import { CustomerType } from '@domain/enums/customer-type.enum';
import { PartEntity } from '@domain/entities/part/part.entity';
import { Logger } from '@nestjs/common';

const makeOrderRepo = (): jest.Mocked<IServiceOrderRepository> => ({
  create: jest.fn(),
  findById: jest.fn(),
  findByOrderNumber: jest.fn(),
  findByCustomerId: jest.fn(),
  findByStatus: jest.fn(),
  findAll: jest.fn(),
  findAllCompleted: jest.fn(),
  update: jest.fn(),
});

const makeCustomerRepo = (): jest.Mocked<ICustomerRepository> =>
  ({
    existsById: jest.fn(),
    findById: jest.fn(),
  }) as unknown as jest.Mocked<ICustomerRepository>;

const makeEmailService = (): jest.Mocked<IEmailNotificationService> => ({
  sendServiceOrderStatusUpdate: jest.fn(),
});

const makeVehicleRepo = (): jest.Mocked<
  Pick<IVehicleRepository, 'findById'>
> => ({
  findById: jest.fn(),
});

const makePartRepo = (): jest.Mocked<
  Pick<IPartRepository, 'findById' | 'update'>
> => ({
  findById: jest.fn(),
  update: jest.fn(),
});

const makeMetrics = (): jest.Mocked<ServiceOrderMetrics> =>
  ({
    recordTransition: jest.fn(),
  }) as unknown as jest.Mocked<ServiceOrderMetrics>;

const makeLogger = (): jest.Mocked<Logger> =>
  ({
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }) as unknown as jest.Mocked<Logger>;

// Sem banco: a transação só executa a função; o "depois do commit" roda na hora.
const makeTransactions = (): jest.Mocked<ITransactionManager> => ({
  run: jest.fn((fn: () => Promise<unknown>) =>
    fn(),
  ) as jest.Mocked<ITransactionManager>['run'],
  afterCommit: jest.fn((fn: () => Promise<void> | void) => {
    void fn();
  }),
});

const makeSagaRepo = (): jest.Mocked<ISagaRepository> => ({
  create: jest.fn((saga: SagaInstanceEntity) => Promise.resolve(saga)),
  update: jest.fn((saga: SagaInstanceEntity) => Promise.resolve(saga)),
  findById: jest.fn(),
  findCurrentByOrderId: jest.fn().mockResolvedValue(null),
  lockCurrentByOrderId: jest.fn().mockResolvedValue(null),
  findExpired: jest.fn().mockResolvedValue([]),
  appendLog: jest.fn(),
  findLogs: jest.fn(),
});

const makeOrder = (status = ServiceOrderStatus.RECEIVED) =>
  ServiceOrderEntity.reconstitute(
    {
      orderNumber: 'OS001',
      customerId: 'c-1',
      vehicleId: 'v-1',
      customerName: 'Jane Doe',
      customerEmail: 'jane@example.com',
      vehiclePlate: 'ABC1D23',
      problemDescription: 'Test',
      status,
      services: [],
      parts: [],
      totalAmount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    'so-1',
  );

const makeCustomer = () =>
  CustomerEntity.reconstitute(
    {
      name: 'Jane Doe',
      document: '12345678900',
      type: CustomerType.INDIVIDUAL,
      email: 'jane@example.com',
      phone: '11999999999',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    'c-1',
  );

describe('StartDiagnosisUseCase', () => {
  it('should transition order to IN_DIAGNOSIS and notify the customer by email', async () => {
    const repo = makeOrderRepo();
    const emailService = makeEmailService();
    const order = makeOrder();
    repo.findById.mockResolvedValue(order);
    repo.update.mockImplementation(async (o) => o);

    const result = await new StartDiagnosisUseCase(
      repo,
      emailService,
      makeMetrics(),
      makeLogger(),
    ).execute('so-1');
    expect(result.status).toBe(ServiceOrderStatus.IN_DIAGNOSIS);
    expect(emailService.sendServiceOrderStatusUpdate).toHaveBeenCalledWith({
      to: 'jane@example.com',
      customerName: 'Jane Doe',
      orderNumber: 'OS001',
      status: ServiceOrderStatus.IN_DIAGNOSIS,
    });
  });

  it('should throw NotFoundException when order not found', async () => {
    const repo = makeOrderRepo();
    repo.findById.mockResolvedValue(null);
    await expect(
      new StartDiagnosisUseCase(
        repo,
        makeEmailService(),
        makeMetrics(),
        makeLogger(),
      ).execute('missing'),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('CancelOrderUseCase', () => {
  const makeUseCase = (
    repo: ReturnType<typeof makeOrderRepo>,
    sagaRepo = makeSagaRepo(),
    processSagaEvent = {
      execute: jest.fn(),
    } as unknown as ProcessSagaEventUseCase,
  ) =>
    new CancelOrderUseCase(
      repo,
      sagaRepo,
      processSagaEvent,
      makeEmailService(),
      makeMetrics(),
      makeLogger(),
    );

  it('should cancel a RECEIVED order (no saga yet)', async () => {
    const repo = makeOrderRepo();
    repo.findById.mockResolvedValue(makeOrder());
    repo.update.mockImplementation(async (o) => o);

    const result = await makeUseCase(repo).execute('so-1');
    expect(result.status).toBe(ServiceOrderStatus.CANCELED);
  });

  it('should cancel through the saga when one is running, so it compensates', async () => {
    const repo = makeOrderRepo();
    const order = makeOrder(ServiceOrderStatus.AWAITING_PAYMENT);
    repo.findById.mockResolvedValue(order);
    const sagaRepo = makeSagaRepo();
    sagaRepo.findCurrentByOrderId.mockResolvedValue(
      SagaInstanceEntity.reconstitute(
        {
          orderId: 'so-1',
          step: SagaStep.AWAITING_PAYMENT,
          status: SagaStatus.RUNNING,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        'saga-1',
      ),
    );
    const canceled = makeOrder(ServiceOrderStatus.CANCELED);
    const processSagaEvent = {
      execute: jest
        .fn()
        .mockResolvedValue({ outcome: 'applied', order: canceled }),
    } as unknown as ProcessSagaEventUseCase;

    const result = await makeUseCase(repo, sagaRepo, processSagaEvent).execute(
      'so-1',
    );

    expect(processSagaEvent.execute).toHaveBeenCalledWith({
      type: 'saga.manual-cancel',
      orderId: 'so-1',
    });
    expect(repo.update).not.toHaveBeenCalled();
    expect(result.status).toBe(ServiceOrderStatus.CANCELED);
  });

  it('should throw when trying to cancel a DELIVERED order', async () => {
    const repo = makeOrderRepo();
    repo.findById.mockResolvedValue(makeOrder(ServiceOrderStatus.DELIVERED));

    await expect(makeUseCase(repo).execute('so-1')).rejects.toThrow();
  });

  it('should throw NotFoundException when order not found', async () => {
    const repo = makeOrderRepo();
    repo.findById.mockResolvedValue(null);
    await expect(makeUseCase(repo).execute('missing')).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('GetServiceOrderUseCase', () => {
  it('should return a service order by id', async () => {
    const repo = makeOrderRepo();
    repo.findById.mockResolvedValue(makeOrder());
    const result = await new GetServiceOrderUseCase(repo, makeLogger()).execute(
      'so-1',
    );
    expect(result.id).toBe('so-1');
  });

  it('should throw NotFoundException when not found', async () => {
    const repo = makeOrderRepo();
    repo.findById.mockResolvedValue(null);
    await expect(
      new GetServiceOrderUseCase(repo, makeLogger()).execute('missing'),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('ListServiceOrdersUseCase', () => {
  it('should return paginated orders', async () => {
    const repo = makeOrderRepo();
    repo.findAll.mockResolvedValue({ data: [makeOrder()], total: 1 });
    const result = await new ListServiceOrdersUseCase(
      repo,
      makeLogger(),
    ).execute({
      page: 1,
      limit: 10,
    });
    expect(result.total).toBe(1);
    expect(result.data).toHaveLength(1);
  });
});

describe('ListServiceOrdersByCustomerUseCase', () => {
  it('should return orders for a customer', async () => {
    const repo = makeOrderRepo();
    repo.findByCustomerId.mockResolvedValue([makeOrder()]);
    const result = await new ListServiceOrdersByCustomerUseCase(
      repo,
      makeLogger(),
    ).execute('c-1');
    expect(result).toHaveLength(1);
  });
});

describe('ListServiceOrdersByStatusUseCase', () => {
  it('should return orders by status', async () => {
    const repo = makeOrderRepo();
    repo.findByStatus.mockResolvedValue([makeOrder()]);
    const result = await new ListServiceOrdersByStatusUseCase(
      repo,
      makeLogger(),
    ).execute(ServiceOrderStatus.RECEIVED);
    expect(result).toHaveLength(1);
  });
});

describe('RequestApprovalUseCase', () => {
  it('should start the saga: AWAITING_APPROVAL + saga + billing.budget.create in the outbox', async () => {
    const repo = makeOrderRepo();
    repo.findById.mockResolvedValue(makeOrder(ServiceOrderStatus.IN_DIAGNOSIS));
    repo.update.mockImplementation(async (o) => o);
    const sagaRepo = makeSagaRepo();
    const transactions = makeTransactions();
    const emailService = makeEmailService();

    const result = await new RequestApprovalUseCase(
      repo,
      sagaRepo,
      transactions,
      emailService,
      makeMetrics(),
      makeLogger(),
    ).execute('so-1');

    expect(result.status).toBe(ServiceOrderStatus.AWAITING_APPROVAL);
    expect(transactions.run).toHaveBeenCalledTimes(1);

    const saga = sagaRepo.create.mock.calls[0][0];
    expect(saga.orderId).toBe('so-1');
    expect(saga.step).toBe(SagaStep.BUDGET_CREATION);
    expect(saga.status).toBe(SagaStatus.RUNNING);

    const [, messages] = repo.update.mock.calls[0];
    expect(messages).toHaveLength(1);
    expect(messages![0]).toMatchObject({
      exchange: 'saga.commands',
      routingKey: 'billing.budget.create',
      envelope: {
        sagaId: saga.id,
        orderId: 'so-1',
        type: 'billing.budget.create',
        payload: {
          customer: { id: 'c-1', name: 'Jane Doe', email: 'jane@example.com' },
          vehiclePlate: 'ABC1D23',
          totalAmount: '0.00',
        },
      },
    });
    expect(sagaRepo.appendLog).toHaveBeenCalledWith(
      expect.objectContaining({ sagaId: saga.id, outcome: 'STARTED' }),
    );
    expect(emailService.sendServiceOrderStatusUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: ServiceOrderStatus.AWAITING_APPROVAL }),
    );
  });

  it('should throw when order not found', async () => {
    const repo = makeOrderRepo();
    repo.findById.mockResolvedValue(null);
    await expect(
      new RequestApprovalUseCase(
        repo,
        makeSagaRepo(),
        makeTransactions(),
        makeEmailService(),
        makeMetrics(),
        makeLogger(),
      ).execute('missing'),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('AddServiceToOrderUseCase', () => {
  it('should add a service to an order', async () => {
    const orderRepo = makeOrderRepo();
    const serviceRepo = { findById: jest.fn() } as any;
    const order = makeOrder();
    orderRepo.findById.mockResolvedValue(order);
    orderRepo.update.mockImplementation(async (o) => o);

    const { ServiceEntity } =
      await import('@domain/entities/service/service.entity');
    const service = ServiceEntity.reconstitute(
      {
        name: 'Troca de Óleo',
        price: 80,
        estimatedDurationMinutes: 30,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      'svc-1',
    );
    serviceRepo.findById.mockResolvedValue(service);

    const result = await new AddServiceToOrderUseCase(
      orderRepo,
      serviceRepo,
      makeLogger(),
    ).execute('so-1', {
      serviceId: 'svc-1',
      quantity: 1,
    });
    expect(result.services).toHaveLength(1);
  });

  it('should throw NotFoundException when service not found', async () => {
    const orderRepo = makeOrderRepo();
    const serviceRepo = { findById: jest.fn().mockResolvedValue(null) } as any;
    orderRepo.findById.mockResolvedValue(makeOrder());

    await expect(
      new AddServiceToOrderUseCase(
        orderRepo,
        serviceRepo,
        makeLogger(),
      ).execute('so-1', {
        serviceId: 'missing',
        quantity: 1,
      }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('DeliverOrderUseCase', () => {
  // COMPLETED agora vem do evento execution.job.completed (saga).
  it('should deliver a completed order', async () => {
    const repo = makeOrderRepo();
    repo.findById.mockResolvedValue(makeOrder(ServiceOrderStatus.COMPLETED));
    repo.update.mockImplementation(async (o) => o);

    const delivered = await new DeliverOrderUseCase(
      repo,
      makeEmailService(),
      makeMetrics(),
      makeLogger(),
    ).execute('so-1');
    expect(delivered.status).toBe(ServiceOrderStatus.DELIVERED);
    expect(delivered.deliveredAt).toBeInstanceOf(Date);
  });
});

describe('CreateServiceOrderUseCase', () => {
  it('should throw NotFoundException when customer does not exist', async () => {
    const orderRepo = makeOrderRepo();
    const customerRepo = makeCustomerRepo() as any;
    const vehicleRepo = makeVehicleRepo() as any;
    customerRepo.findById = jest.fn().mockResolvedValue(null);

    const useCase = new CreateServiceOrderUseCase(
      orderRepo,
      customerRepo,
      vehicleRepo,
      makeMetrics(),
      makeLogger(),
    );
    await expect(
      useCase.execute({
        customerId: 'c-1',
        vehicleId: 'v-1',
        problemDescription: 'Test',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw BusinessRuleException when vehicle belongs to another customer', async () => {
    const orderRepo = makeOrderRepo();
    const customerRepo = {
      findById: jest.fn().mockResolvedValue(makeCustomer()),
    } as any;
    const vehicleRepo = {
      findById: jest.fn().mockResolvedValue({ customerId: 'other-customer' }),
    } as any;

    const useCase = new CreateServiceOrderUseCase(
      orderRepo,
      customerRepo,
      vehicleRepo,
      makeMetrics(),
      makeLogger(),
    );
    await expect(
      useCase.execute({
        customerId: 'c-1',
        vehicleId: 'v-1',
        problemDescription: 'Test',
      }),
    ).rejects.toThrow(BusinessRuleException);
  });

  it('should throw NotFoundException when vehicle does not exist', async () => {
    const orderRepo = makeOrderRepo();
    const customerRepo = {
      findById: jest.fn().mockResolvedValue(makeCustomer()),
    } as any;
    const vehicleRepo = {
      findById: jest.fn().mockResolvedValue(null),
    } as any;

    const useCase = new CreateServiceOrderUseCase(
      orderRepo,
      customerRepo,
      vehicleRepo,
      makeMetrics(),
      makeLogger(),
    );
    await expect(
      useCase.execute({
        customerId: 'c-1',
        vehicleId: 'v-1',
        problemDescription: 'Test',
      }),
    ).rejects.toThrow(NotFoundException);
    expect(orderRepo.create).not.toHaveBeenCalled();
  });

  it('should create a RECEIVED order with a generated order number', async () => {
    const orderRepo = makeOrderRepo();
    orderRepo.create.mockImplementation((order) => Promise.resolve(order));
    const customerRepo = {
      findById: jest.fn().mockResolvedValue(makeCustomer()),
    } as any;
    const vehicleRepo = {
      findById: jest
        .fn()
        .mockResolvedValue({ customerId: 'c-1', licensePlate: 'ABC1D23' }),
    } as any;
    const metrics = makeMetrics();

    const useCase = new CreateServiceOrderUseCase(
      orderRepo,
      customerRepo,
      vehicleRepo,
      metrics,
      makeLogger(),
    );
    const response = await useCase.execute({
      customerId: 'c-1',
      vehicleId: 'v-1',
      problemDescription: 'Barulho no freio',
    });

    // "OS" + ano com 4 dígitos + 6 dígitos aleatórios
    const year = new Date().getFullYear();
    expect(response.orderNumber).toMatch(new RegExp(`^OS${year}\\d{6}$`));
    expect(response.status).toBe(ServiceOrderStatus.RECEIVED);
    expect(response.customerId).toBe('c-1');
    expect(response.vehicleId).toBe('v-1');
    // Dados do cliente e do veículo gravados na OS na abertura.
    expect(response.customerName).toBe('Jane Doe');
    expect(response.vehiclePlate).toBe('ABC1D23');
    const created = orderRepo.create.mock.calls[0][0];
    expect(created.customerEmail).toBe('jane@example.com');
    expect(orderRepo.create).toHaveBeenCalledTimes(1);
    expect(metrics.recordTransition).toHaveBeenCalledWith({
      fromStatus: 'NONE',
      toStatus: ServiceOrderStatus.RECEIVED,
    });
  });
});

describe('AddPartToOrderUseCase', () => {
  it('should throw InsufficientStockException when not enough stock', async () => {
    const orderRepo = makeOrderRepo();
    const partRepo = makePartRepo() as any;

    const order = makeOrder();
    orderRepo.findById.mockResolvedValue(order);

    const part = PartEntity.create(
      {
        name: 'Filtro',
        code: 'F-001',
        price: 25,
        stockQuantity: 2,
        minStockQuantity: 1,
      },
      'p-1',
    );
    partRepo.findById = jest.fn().mockResolvedValue(part);

    const useCase = new AddPartToOrderUseCase(
      orderRepo,
      partRepo,
      makeLogger(),
    );
    await expect(
      useCase.execute('so-1', { partId: 'p-1', quantity: 10 }),
    ).rejects.toThrow(InsufficientStockException);
  });

  // A baixa acontece na aprovação do orçamento (saga), não aqui.
  it('should add the part without touching the stock', async () => {
    const orderRepo = makeOrderRepo();
    orderRepo.findById.mockResolvedValue(makeOrder());
    orderRepo.update.mockImplementation(async (o) => o);
    const partRepo = makePartRepo();
    const part = PartEntity.create(
      {
        name: 'Filtro',
        code: 'F-001',
        price: 25,
        stockQuantity: 5,
        minStockQuantity: 1,
      },
      'p-1',
    );
    partRepo.findById.mockResolvedValue(part);

    const result = await new AddPartToOrderUseCase(
      orderRepo,
      partRepo as any,
      makeLogger(),
    ).execute('so-1', { partId: 'p-1', quantity: 2 });

    expect(result.parts).toHaveLength(1);
    expect(part.stockQuantity).toBe(5);
    expect(partRepo.update).not.toHaveBeenCalled();
  });
});

describe('TrackServiceOrderUseCase', () => {
  it('should return public view of an order by order number', async () => {
    const repo = makeOrderRepo();
    const order = makeOrder();
    repo.findByOrderNumber.mockResolvedValue(order);

    const result = await new TrackServiceOrderUseCase(
      repo,
      makeLogger(),
    ).execute('OS001');
    expect(result.orderNumber).toBe('OS001');
    expect(result.status).toBe(ServiceOrderStatus.RECEIVED);
    expect(result).not.toHaveProperty('id');
    expect(result).not.toHaveProperty('customerId');
  });

  it('should throw NotFoundException when order number does not exist', async () => {
    const repo = makeOrderRepo();
    repo.findByOrderNumber.mockResolvedValue(null);

    await expect(
      new TrackServiceOrderUseCase(repo, makeLogger()).execute('OS-NOTFOUND'),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('GetAverageExecutionTimeUseCase', () => {
  it('should return zeroes when there are no completed orders', async () => {
    const repo = makeOrderRepo();
    repo.findAllCompleted.mockResolvedValue([]);

    const result = await new GetAverageExecutionTimeUseCase(
      repo,
      makeLogger(),
    ).execute();
    expect(result.globalAverageMinutes).toBe(0);
    expect(result.completedOrders).toBe(0);
    expect(result.byService).toEqual([]);
  });

  it('should calculate average execution time from completed orders', async () => {
    const repo = makeOrderRepo();
    const start = new Date('2025-01-01T08:00:00Z');
    const finish = new Date('2025-01-01T10:00:00Z'); // 120 min
    const order = ServiceOrderEntity.reconstitute(
      {
        orderNumber: 'OS2025000001',
        customerId: 'c-1',
        vehicleId: 'v-1',
        customerName: 'Jane Doe',
        customerEmail: 'jane@example.com',
        vehiclePlate: 'ABC1D23',
        problemDescription: 'Test',
        status: ServiceOrderStatus.DELIVERED,
        services: [
          {
            serviceId: 's-1',
            serviceName: 'Troca de óleo',
            price: 50,
            quantity: 1,
          },
        ],
        parts: [],
        totalAmount: 50,
        startedAt: start,
        finishedAt: finish,
        createdAt: start,
        updatedAt: finish,
      },
      'so-2',
    );
    repo.findAllCompleted.mockResolvedValue([order]);

    const result = await new GetAverageExecutionTimeUseCase(
      repo,
      makeLogger(),
    ).execute();
    expect(result.globalAverageMinutes).toBe(120);
    expect(result.completedOrders).toBe(1);
    expect(result.byService).toHaveLength(1);
    expect(result.byService[0].serviceId).toBe('s-1');
    expect(result.byService[0].averageMinutes).toBe(120);
  });
});
