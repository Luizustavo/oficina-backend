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
import { CompleteOrderUseCase } from './complete-order.use-case';
import { ApproveOrderUseCase } from './approve-order.use-case';
import { DeliverOrderUseCase } from './deliver-order.use-case';
import { ICustomerRepository } from '@domain/repositories/customer.repository.interface';
import { CancelOrderUseCase } from './cancel-order.use-case';
import { IVehicleRepository } from '@domain/repositories/vehicle.repository.interface';
import { ServiceOrderEntity } from '@domain/entities/service-order/service-order.entity';
import { ServiceOrderStatus } from '@domain/validators/value-objects/service-order-status.value-object';
import { IPartRepository } from '@domain/repositories/part.repository.interface';
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

const makeLogger = (): jest.Mocked<Logger> =>
  ({
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }) as unknown as jest.Mocked<Logger>;

const makeOrder = (status = ServiceOrderStatus.RECEIVED) =>
  ServiceOrderEntity.reconstitute(
    {
      orderNumber: 'OS001',
      customerId: 'c-1',
      vehicleId: 'v-1',
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
    const customerRepo = makeCustomerRepo();
    const emailService = makeEmailService();
    const order = makeOrder();
    repo.findById.mockResolvedValue(order);
    repo.update.mockImplementation(async (o) => o);
    customerRepo.findById.mockResolvedValue(makeCustomer());

    const result = await new StartDiagnosisUseCase(
      repo,
      customerRepo,
      emailService,
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

  it('should skip the email notification when the customer cannot be found', async () => {
    const repo = makeOrderRepo();
    const customerRepo = makeCustomerRepo();
    const emailService = makeEmailService();
    const order = makeOrder();
    repo.findById.mockResolvedValue(order);
    repo.update.mockImplementation(async (o) => o);
    customerRepo.findById.mockResolvedValue(null);

    const result = await new StartDiagnosisUseCase(
      repo,
      customerRepo,
      emailService,
      makeLogger(),
    ).execute('so-1');
    expect(result.status).toBe(ServiceOrderStatus.IN_DIAGNOSIS);
    expect(emailService.sendServiceOrderStatusUpdate).not.toHaveBeenCalled();
  });

  it('should throw NotFoundException when order not found', async () => {
    const repo = makeOrderRepo();
    repo.findById.mockResolvedValue(null);
    await expect(
      new StartDiagnosisUseCase(
        repo,
        makeCustomerRepo(),
        makeEmailService(),
        makeLogger(),
      ).execute('missing'),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('CancelOrderUseCase', () => {
  it('should cancel a RECEIVED order', async () => {
    const repo = makeOrderRepo();
    const customerRepo = makeCustomerRepo();
    const order = makeOrder();
    repo.findById.mockResolvedValue(order);
    repo.update.mockImplementation(async (o) => o);
    customerRepo.findById.mockResolvedValue(makeCustomer());

    const result = await new CancelOrderUseCase(
      repo,
      customerRepo,
      makeEmailService(),
      makeLogger(),
    ).execute('so-1');
    expect(result.status).toBe(ServiceOrderStatus.CANCELED);
  });

  it('should throw when trying to cancel a DELIVERED order', async () => {
    const repo = makeOrderRepo();
    repo.findById.mockResolvedValue(makeOrder(ServiceOrderStatus.DELIVERED));

    await expect(
      new CancelOrderUseCase(
        repo,
        makeCustomerRepo(),
        makeEmailService(),
        makeLogger(),
      ).execute('so-1'),
    ).rejects.toThrow();
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
  it('should request approval from IN_DIAGNOSIS status', async () => {
    const repo = makeOrderRepo();
    const customerRepo = makeCustomerRepo();
    const order = makeOrder(ServiceOrderStatus.IN_DIAGNOSIS);
    repo.findById.mockResolvedValue(order);
    repo.update.mockImplementation(async (o) => o);
    customerRepo.findById.mockResolvedValue(makeCustomer());

    const result = await new RequestApprovalUseCase(
      repo,
      customerRepo,
      makeEmailService(),
      makeLogger(),
    ).execute('so-1');
    expect(result.status).toBe(ServiceOrderStatus.AWAITING_APPROVAL);
  });

  it('should throw when order not found', async () => {
    const repo = makeOrderRepo();
    repo.findById.mockResolvedValue(null);
    await expect(
      new RequestApprovalUseCase(
        repo,
        makeCustomerRepo(),
        makeEmailService(),
        makeLogger(),
      ).execute('missing'),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('ApproveOrderUseCase', () => {
  it('should approve an order awaiting approval', async () => {
    const repo = makeOrderRepo();
    const customerRepo = makeCustomerRepo();
    const order = makeOrder(ServiceOrderStatus.AWAITING_APPROVAL);
    repo.findById.mockResolvedValue(order);
    repo.update.mockImplementation(async (o) => o);
    customerRepo.findById.mockResolvedValue(makeCustomer());

    const result = await new ApproveOrderUseCase(
      repo,
      customerRepo,
      makeEmailService(),
      makeLogger(),
    ).execute('so-1');
    expect(result.status).toBe(ServiceOrderStatus.IN_PROGRESS);
  });

  it('should throw when order not found', async () => {
    const repo = makeOrderRepo();
    repo.findById.mockResolvedValue(null);
    await expect(
      new ApproveOrderUseCase(
        repo,
        makeCustomerRepo(),
        makeEmailService(),
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

describe('CompleteOrderUseCase → DeliverOrderUseCase pipeline', () => {
  it('should complete then deliver an order', async () => {
    const repo = makeOrderRepo();
    const customerRepo = makeCustomerRepo();
    const order = makeOrder(ServiceOrderStatus.IN_PROGRESS);
    repo.findById.mockResolvedValue(order);
    repo.update.mockImplementation(async (o) => o);
    customerRepo.findById.mockResolvedValue(makeCustomer());

    const completed = await new CompleteOrderUseCase(
      repo,
      customerRepo,
      makeEmailService(),
      makeLogger(),
    ).execute('so-1');
    expect(completed.status).toBe(ServiceOrderStatus.COMPLETED);

    repo.findById.mockResolvedValue(order);
    const delivered = await new DeliverOrderUseCase(
      repo,
      customerRepo,
      makeEmailService(),
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
    customerRepo.existsById = jest.fn().mockResolvedValue(false);

    const useCase = new CreateServiceOrderUseCase(
      orderRepo,
      customerRepo,
      vehicleRepo,
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
      existsById: jest.fn().mockResolvedValue(true),
    } as any;
    const vehicleRepo = {
      findById: jest.fn().mockResolvedValue({ customerId: 'other-customer' }),
    } as any;

    const useCase = new CreateServiceOrderUseCase(
      orderRepo,
      customerRepo,
      vehicleRepo,
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
