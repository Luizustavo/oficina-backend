import {
  CreateServiceUseCase,
  GetServiceUseCase,
  ToggleServiceUseCase,
  DeleteServiceUseCase,
} from './service.use-cases';
import { IServiceRepository } from '../../../domain/repositories/service.repository.interface';
import { Service } from '../../../domain/entities/service/service.entity';
import { NotFoundException } from '../../../shared/exceptions/domain.exceptions';

const makeRepo = (): jest.Mocked<IServiceRepository> => ({
  create: jest.fn(),
  findById: jest.fn(),
  findAll: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});

const makeService = (isActive = true) =>
  Service.reconstitute({
    id: 's-1',
    name: 'Troca de Óleo',
    price: 80,
    estimatedDurationMinutes: 30,
    isActive,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

describe('CreateServiceUseCase', () => {
  it('should create and return a service', async () => {
    const repo = makeRepo();
    repo.create.mockImplementation(async (s) => s);

    const result = await new CreateServiceUseCase(repo).execute({
      name: 'Troca de Óleo',
      price: 80,
      estimatedDurationMinutes: 30,
    });

    expect(result.name).toBe('Troca de Óleo');
    expect(result.isActive).toBe(true);
  });
});

describe('GetServiceUseCase', () => {
  it('should return a service by id', async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValue(makeService());

    const result = await new GetServiceUseCase(repo).execute('s-1');
    expect(result.id).toBe('s-1');
  });

  it('should throw NotFoundException when not found', async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValue(null);
    await expect(
      new GetServiceUseCase(repo).execute('missing'),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('ToggleServiceUseCase', () => {
  it('should deactivate an active service', async () => {
    const repo = makeRepo();
    const service = makeService(true);
    repo.findById.mockResolvedValue(service);
    repo.update.mockImplementation(async (s) => s);

    const result = await new ToggleServiceUseCase(repo).execute('s-1');
    expect(result.isActive).toBe(false);
  });

  it('should throw NotFoundException when not found', async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValue(null);
    await expect(
      new ToggleServiceUseCase(repo).execute('missing'),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('DeleteServiceUseCase', () => {
  it('should delete a service', async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValue(makeService());
    repo.delete.mockResolvedValue();

    await expect(
      new DeleteServiceUseCase(repo).execute('s-1'),
    ).resolves.toBeUndefined();
    expect(repo.delete).toHaveBeenCalledWith('s-1');
  });

  it('should throw NotFoundException when not found', async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValue(null);
    await expect(
      new DeleteServiceUseCase(repo).execute('missing'),
    ).rejects.toThrow(NotFoundException);
  });
});
