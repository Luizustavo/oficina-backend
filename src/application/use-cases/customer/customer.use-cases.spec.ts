import {
  NotFoundException,
  BusinessRuleException,
} from '@shared/exceptions/domain.exceptions';
import { GetCustomerByDocumentUseCase } from './get-customer-by-document.use-case';
import { UpdateCustomerUseCase } from './update-customer.use-case';
import { DeleteCustomerUseCase } from './delete-customer.use-case';
import { ListCustomersUseCase } from './list-customers.use-case';
import { ICustomerRepository } from '@domain/repositories/customer.repository.interface';
import { GetCustomerUseCase } from './get-customer.use-case';
import { CustomerEntity } from '@domain/entities/customer/customer.entity';
import { CustomerType } from '@domain/enums/customer-type.enum';
import { Logger } from '@nestjs/common';

const makeRepo = (): jest.Mocked<ICustomerRepository> => ({
  findById: jest.fn(),
  findAll: jest.fn(),
  findByDocument: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  existsById: jest.fn(),
  hasServiceOrders: jest.fn(),
});

const makeLogger = (): jest.Mocked<Logger> =>
  ({
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }) as unknown as jest.Mocked<Logger>;

const makeCustomer = () =>
  CustomerEntity.reconstitute(
    {
      name: 'Carlos Silva',
      document: '52998224725',
      type: CustomerType.INDIVIDUAL,
      email: 'carlos@email.com',
      phone: '11999990001',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    'c-1',
  );

describe('ListCustomersUseCase', () => {
  it('should return paginated customers', async () => {
    const repo = makeRepo();
    const customer = makeCustomer();
    repo.findAll.mockResolvedValue({ data: [customer], total: 1 });

    const result = await new ListCustomersUseCase(repo, makeLogger()).execute({
      page: 1,
      limit: 10,
    });

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it('should use defaults for page and limit', async () => {
    const repo = makeRepo();
    repo.findAll.mockResolvedValue({ data: [], total: 0 });

    const result = await new ListCustomersUseCase(repo, makeLogger()).execute(
      {},
    );
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });
});

describe('GetCustomerUseCase', () => {
  it('should return a customer by id', async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValue(makeCustomer());

    const result = await new GetCustomerUseCase(repo, makeLogger()).execute(
      'c-1',
    );
    expect(result.id).toBe('c-1');
  });

  it('should throw NotFoundException when not found', async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValue(null);
    await expect(
      new GetCustomerUseCase(repo, makeLogger()).execute('missing'),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('GetCustomerByDocumentUseCase', () => {
  it('should find customer by document (strips formatting)', async () => {
    const repo = makeRepo();
    repo.findByDocument.mockResolvedValue(makeCustomer());

    const result = await new GetCustomerByDocumentUseCase(
      repo,
      makeLogger(),
    ).execute('529.982.247-25');
    expect(repo.findByDocument).toHaveBeenCalledWith('52998224725');
    expect(result.document).toBe('52998224725');
  });

  it('should throw NotFoundException when not found', async () => {
    const repo = makeRepo();
    repo.findByDocument.mockResolvedValue(null);
    await expect(
      new GetCustomerByDocumentUseCase(repo, makeLogger()).execute(
        '52998224725',
      ),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('UpdateCustomerUseCase', () => {
  it('should update and return the customer', async () => {
    const repo = makeRepo();
    const customer = makeCustomer();
    repo.findById.mockResolvedValue(customer);
    repo.update.mockImplementation(async (c) => c);

    const result = await new UpdateCustomerUseCase(repo, makeLogger()).execute(
      'c-1',
      {
        id: 'c-1',
        name: 'Carlos Updated',
      },
    );
    expect(result.name).toBe('Carlos Updated');
  });

  it('should throw NotFoundException when customer not found', async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValue(null);
    await expect(
      new UpdateCustomerUseCase(repo, makeLogger()).execute('missing', {
        id: 'missing',
      }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('DeleteCustomerUseCase', () => {
  it('should delete a customer without orders', async () => {
    const repo = makeRepo();
    repo.existsById.mockResolvedValue(true);
    repo.hasServiceOrders.mockResolvedValue(false);
    repo.delete.mockResolvedValue();

    await expect(
      new DeleteCustomerUseCase(repo, makeLogger()).execute('c-1'),
    ).resolves.toBeUndefined();
    expect(repo.delete).toHaveBeenCalledWith('c-1');
  });

  it('should throw NotFoundException when customer does not exist', async () => {
    const repo = makeRepo();
    repo.existsById.mockResolvedValue(false);
    await expect(
      new DeleteCustomerUseCase(repo, makeLogger()).execute('missing'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw BusinessRuleException when customer has service orders', async () => {
    const repo = makeRepo();
    repo.existsById.mockResolvedValue(true);
    repo.hasServiceOrders.mockResolvedValue(true);
    await expect(
      new DeleteCustomerUseCase(repo, makeLogger()).execute('c-1'),
    ).rejects.toThrow(BusinessRuleException);
  });
});
