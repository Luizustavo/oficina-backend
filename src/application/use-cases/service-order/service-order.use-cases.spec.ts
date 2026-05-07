import {
  StartDiagnosisUseCase,
  RequestApprovalUseCase,
  ApproveOrderUseCase,
  CompleteOrderUseCase,
  DeliverOrderUseCase,
  CancelOrderUseCase,
  CreateServiceOrderUseCase,
  AddPartToOrderUseCase,
  GetServiceOrderUseCase,
  ListServiceOrdersUseCase,
  ListServiceOrdersByCustomerUseCase,
  ListServiceOrdersByStatusUseCase,
  AddServiceToOrderUseCase,
  TrackServiceOrderUseCase,
  GetAverageExecutionTimeUseCase,
} from './service-order.use-cases';
import { IServiceOrderRepository } from '../../../domain/service-order/service-order.repository.interface';
import { ICustomerRepository } from '../../../domain/customer/customer.repository.interface';
import { IVehicleRepository } from '../../../domain/vehicle/vehicle.repository.interface';
import { IPartRepository } from '../../../domain/part/part.repository.interface';
import { ServiceOrder } from '../../../domain/service-order/service-order.entity';
import { ServiceOrderStatus } from '../../../domain/value-objects/service-order-status.value-object';
import {
  NotFoundException,
  InsufficientStockException,
  BusinessRuleException,
} from '../../../shared/exceptions/domain.exceptions';
import { Part } from '../../../domain/part/part.entity';

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

const makeCustomerRepo = (): jest.Mocked<
  Pick<ICustomerRepository, 'existsById'>
> => ({
  existsById: jest.fn(),
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

const makeOrder = (status = ServiceOrderStatus.RECEIVED) =>
  ServiceOrder.reconstitute({
    id: 'so-1',
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
  });

describe('StartDiagnosisUseCase', () => {
  it('should transition order to IN_DIAGNOSIS', async () => {
    const repo = makeOrderRepo();
    const order = makeOrder();
    repo.findById.mockResolvedValue(order);
    repo.update.mockImplementation(async (o) => o);

    const result = await new StartDiagnosisUseCase(repo).execute('so-1');
    expect(result.status).toBe(ServiceOrderStatus.IN_DIAGNOSIS);
  });

  it('should throw NotFoundException when order not found', async () => {
    const repo = makeOrderRepo();
    repo.findById.mockResolvedValue(null);
    await expect(
      new StartDiagnosisUseCase(repo).execute('missing'),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('CancelOrderUseCase', () => {
  it('should cancel a RECEIVED order', async () => {
    const repo = makeOrderRepo();
    const order = makeOrder();
    repo.findById.mockResolvedValue(order);
    repo.update.mockImplementation(async (o) => o);

    const result = await new CancelOrderUseCase(repo).execute('so-1');
    expect(result.status).toBe(ServiceOrderStatus.CANCELED);
  });

  it('should throw when trying to cancel a DELIVERED order', async () => {
    const repo = makeOrderRepo();
    repo.findById.mockResolvedValue(makeOrder(ServiceOrderStatus.DELIVERED));

    await expect(
      new CancelOrderUseCase(repo).execute('so-1'),
    ).rejects.toThrow();
  });
});

describe('GetServiceOrderUseCase', () => {
  it('should return a service order by id', async () => {
    const repo = makeOrderRepo();
    repo.findById.mockResolvedValue(makeOrder());
    const result = await new GetServiceOrderUseCase(repo).execute('so-1');
    expect(result.id).toBe('so-1');
  });

  it('should throw NotFoundException when not found', async () => {
    const repo = makeOrderRepo();
    repo.findById.mockResolvedValue(null);
    await expect(
      new GetServiceOrderUseCase(repo).execute('missing'),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('ListServiceOrdersUseCase', () => {
  it('should return paginated orders', async () => {
    const repo = makeOrderRepo();
    repo.findAll.mockResolvedValue({ data: [makeOrder()], total: 1 });
    const result = await new ListServiceOrdersUseCase(repo).execute({
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
    const result = await new ListServiceOrdersByCustomerUseCase(repo).execute(
      'c-1',
    );
    expect(result).toHaveLength(1);
  });
});

describe('ListServiceOrdersByStatusUseCase', () => {
  it('should return orders by status', async () => {
    const repo = makeOrderRepo();
    repo.findByStatus.mockResolvedValue([makeOrder()]);
    const result = await new ListServiceOrdersByStatusUseCase(repo).execute(
      ServiceOrderStatus.RECEIVED,
    );
    expect(result).toHaveLength(1);
  });
});

describe('RequestApprovalUseCase', () => {
  it('should request approval from IN_DIAGNOSIS status', async () => {
    const repo = makeOrderRepo();
    const order = makeOrder(ServiceOrderStatus.IN_DIAGNOSIS);
    repo.findById.mockResolvedValue(order);
    repo.update.mockImplementation(async (o) => o);

    const result = await new RequestApprovalUseCase(repo).execute('so-1');
    expect(result.status).toBe(ServiceOrderStatus.AWAITING_APPROVAL);
  });

  it('should throw when order not found', async () => {
    const repo = makeOrderRepo();
    repo.findById.mockResolvedValue(null);
    await expect(
      new RequestApprovalUseCase(repo).execute('missing'),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('ApproveOrderUseCase', () => {
  it('should approve an order awaiting approval', async () => {
    const repo = makeOrderRepo();
    const order = makeOrder(ServiceOrderStatus.AWAITING_APPROVAL);
    repo.findById.mockResolvedValue(order);
    repo.update.mockImplementation(async (o) => o);

    const result = await new ApproveOrderUseCase(repo).execute('so-1');
    expect(result.status).toBe(ServiceOrderStatus.IN_PROGRESS);
  });

  it('should throw when order not found', async () => {
    const repo = makeOrderRepo();
    repo.findById.mockResolvedValue(null);
    await expect(
      new ApproveOrderUseCase(repo).execute('missing'),
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

    const { Service } = await import('../../../domain/service/service.entity');
    const service = Service.reconstitute({
      id: 'svc-1',
      name: 'Troca de Óleo',
      price: 80,
      estimatedDurationMinutes: 30,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    serviceRepo.findById.mockResolvedValue(service);

    const result = await new AddServiceToOrderUseCase(
      orderRepo,
      serviceRepo,
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
      new AddServiceToOrderUseCase(orderRepo, serviceRepo).execute('so-1', {
        serviceId: 'missing',
        quantity: 1,
      }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('CompleteOrderUseCase → DeliverOrderUseCase pipeline', () => {
  it('should complete then deliver an order', async () => {
    const repo = makeOrderRepo();
    const order = makeOrder(ServiceOrderStatus.IN_PROGRESS);
    repo.findById.mockResolvedValue(order);
    repo.update.mockImplementation(async (o) => o);

    const completed = await new CompleteOrderUseCase(repo).execute('so-1');
    expect(completed.status).toBe(ServiceOrderStatus.COMPLETED);

    repo.findById.mockResolvedValue(order);
    const delivered = await new DeliverOrderUseCase(repo).execute('so-1');
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

    const part = Part.create({
      id: 'p-1',
      name: 'Filtro',
      code: 'F-001',
      price: 25,
      stockQuantity: 2,
      minStockQuantity: 1,
    });
    partRepo.findById = jest.fn().mockResolvedValue(part);

    const useCase = new AddPartToOrderUseCase(orderRepo, partRepo);
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

    const result = await new TrackServiceOrderUseCase(repo).execute('OS001');
    expect(result.orderNumber).toBe('OS001');
    expect(result.status).toBe(ServiceOrderStatus.RECEIVED);
    expect(result).not.toHaveProperty('id');
    expect(result).not.toHaveProperty('customerId');
  });

  it('should throw NotFoundException when order number does not exist', async () => {
    const repo = makeOrderRepo();
    repo.findByOrderNumber.mockResolvedValue(null);

    await expect(
      new TrackServiceOrderUseCase(repo).execute('OS-NOTFOUND'),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('GetAverageExecutionTimeUseCase', () => {
  it('should return zeroes when there are no completed orders', async () => {
    const repo = makeOrderRepo();
    repo.findAllCompleted.mockResolvedValue([]);

    const result = await new GetAverageExecutionTimeUseCase(repo).execute();
    expect(result.globalAverageMinutes).toBe(0);
    expect(result.completedOrders).toBe(0);
    expect(result.byService).toEqual([]);
  });

  it('should calculate average execution time from completed orders', async () => {
    const repo = makeOrderRepo();
    const start = new Date('2025-01-01T08:00:00Z');
    const finish = new Date('2025-01-01T10:00:00Z'); // 120 min
    const order = ServiceOrder.reconstitute({
      id: 'so-2',
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
    });
    repo.findAllCompleted.mockResolvedValue([order]);

    const result = await new GetAverageExecutionTimeUseCase(repo).execute();
    expect(result.globalAverageMinutes).toBe(120);
    expect(result.completedOrders).toBe(1);
    expect(result.byService).toHaveLength(1);
    expect(result.byService[0].serviceId).toBe('s-1');
    expect(result.byService[0].averageMinutes).toBe(120);
  });
});
