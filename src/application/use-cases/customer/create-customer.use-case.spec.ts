import { CreateCustomerUseCase } from './create-customer.use-case';
import { ICustomerRepository } from '../../../domain/repositories/customer.repository.interface';
import { ConflictException } from '../../../shared/exceptions/domain.exceptions';
import { CustomerType } from '../../../domain/enums/customer-type.enum';
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

describe('CreateCustomerUseCase', () => {
  let useCase: CreateCustomerUseCase;
  let repo: jest.Mocked<ICustomerRepository>;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new CreateCustomerUseCase(repo, makeLogger());
  });

  const validDto = {
    name: 'Carlos Silva',
    document: '52998224725',
    type: CustomerType.INDIVIDUAL,
    email: 'carlos@email.com',
    phone: '11999990001',
  };

  it('should create a customer when document is not taken', async () => {
    repo.findByDocument.mockResolvedValue(null);
    repo.create.mockImplementation(async (c) => c);

    const result = await useCase.execute(validDto);

    expect(repo.findByDocument).toHaveBeenCalledWith('52998224725');
    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(result.name).toBe('Carlos Silva');
    expect(result.type).toBe(CustomerType.INDIVIDUAL);
  });

  it('should throw ConflictException when document is already registered', async () => {
    repo.findByDocument.mockResolvedValue({ id: 'existing' } as any);

    await expect(useCase.execute(validDto)).rejects.toThrow(ConflictException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('should strip non-digit characters from the document before saving', async () => {
    repo.findByDocument.mockResolvedValue(null);
    repo.create.mockImplementation(async (c) => c);

    await useCase.execute({ ...validDto, document: '529.982.247-25' });

    const createdCustomer = repo.create.mock.calls[0][0];
    expect(createdCustomer.document).toBe('52998224725');
  });
});
