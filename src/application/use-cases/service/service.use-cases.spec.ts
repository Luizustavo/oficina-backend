import { CreateServiceUseCase } from './create-service.use-case';
import { ToggleServiceUseCase } from './toggle-service.use-case';
import { DeleteServiceUseCase } from './delete-service.use-case';
import { IServiceRepository } from '@domain/repositories/service.repository.interface';
import { GetServiceUseCase } from './get-service.use-case';
import { NotFoundException } from '@shared/exceptions/domain.exceptions';
import { ServiceEntity } from '@domain/entities/service/service.entity';
import { Logger } from '@nestjs/common';

const makeRepo = (): jest.Mocked<IServiceRepository> => ({
  create: jest.fn(),
  findById: jest.fn(),
  findAll: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});

const makeLogger = (): jest.Mocked<Logger> =>
  ({
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }) as unknown as jest.Mocked<Logger>;

const makeService = (isActive = true) =>
  ServiceEntity.reconstitute(
    {
      name: 'Troca de Óleo',
      price: 80,
      estimatedDurationMinutes: 30,
      isActive,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    's-1',
  );

describe('CreateServiceUseCase', () => {
  it('should create and return a service', async () => {
    const repo = makeRepo();
    repo.create.mockImplementation(async (s) => s);

    const result = await new CreateServiceUseCase(repo, makeLogger()).execute({
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

    const result = await new GetServiceUseCase(repo, makeLogger()).execute(
      's-1',
    );
    expect(result.id).toBe('s-1');
  });

  it('should throw NotFoundException when not found', async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValue(null);
    await expect(
      new GetServiceUseCase(repo, makeLogger()).execute('missing'),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('ToggleServiceUseCase', () => {
  it('should deactivate an active service', async () => {
    const repo = makeRepo();
    const service = makeService(true);
    repo.findById.mockResolvedValue(service);
    repo.update.mockImplementation(async (s) => s);

    const result = await new ToggleServiceUseCase(repo, makeLogger()).execute(
      's-1',
    );
    expect(result.isActive).toBe(false);
  });

  it('should throw NotFoundException when not found', async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValue(null);
    await expect(
      new ToggleServiceUseCase(repo, makeLogger()).execute('missing'),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('DeleteServiceUseCase', () => {
  it('should delete a service', async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValue(makeService());
    repo.delete.mockResolvedValue();

    await expect(
      new DeleteServiceUseCase(repo, makeLogger()).execute('s-1'),
    ).resolves.toBeUndefined();
    expect(repo.delete).toHaveBeenCalledWith('s-1');
  });

  it('should throw NotFoundException when not found', async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValue(null);
    await expect(
      new DeleteServiceUseCase(repo, makeLogger()).execute('missing'),
    ).rejects.toThrow(NotFoundException);
  });
});
