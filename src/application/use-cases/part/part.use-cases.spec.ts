import {
  NotFoundException,
  DomainException,
  ConflictException,
} from '@shared/exceptions/domain.exceptions';
import { ListLowStockPartsUseCase } from './list-low-stock-parts.use-case';
import { RemoveStockUseCase } from './remove-stock.use-case';
import { CreatePartUseCase } from './create-part.use-case';
import { UpdatePartUseCase } from './update-part.use-case';
import { DeletePartUseCase } from './delete-part.use-case';
import { ListPartsUseCase } from './list-parts.use-case';
import { AddStockUseCase } from './add-stock.use-case';
import { IPartRepository } from '@domain/repositories/part.repository.interface';
import { GetPartUseCase } from './get-part.use-case';
import { PartEntity } from '@domain/entities/part/part.entity';
import { Logger } from '@nestjs/common';

const makeRepo = (): jest.Mocked<IPartRepository> => ({
  create: jest.fn(),
  findById: jest.fn(),
  findByCode: jest.fn(),
  findAll: jest.fn(),
  findLowStock: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});

const makeLogger = (): jest.Mocked<Logger> =>
  ({
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }) as unknown as jest.Mocked<Logger>;

const makePart = (
  overrides: Partial<Parameters<typeof PartEntity.create>[0]> = {},
) =>
  PartEntity.create(
    {
      name: 'Filtro de Óleo',
      code: 'FO-001',
      price: 25.9,
      stockQuantity: 10,
      minStockQuantity: 3,
      ...overrides,
    },
    'part-1',
  );

describe('GetPartUseCase', () => {
  it('should return the part when found', async () => {
    const repo = makeRepo();
    const part = makePart();
    repo.findById.mockResolvedValue(part);

    const result = await new GetPartUseCase(repo, makeLogger()).execute(
      'part-1',
    );

    expect(result.id).toBe('part-1');
    expect(result.name).toBe('Filtro de Óleo');
  });

  it('should throw NotFoundException when part is not found', async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValue(null);

    await expect(
      new GetPartUseCase(repo, makeLogger()).execute('missing'),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('AddStockUseCase', () => {
  let repo: jest.Mocked<IPartRepository>;
  let useCase: AddStockUseCase;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new AddStockUseCase(repo, makeLogger());
  });

  it('should add stock and persist the updated part', async () => {
    const part = makePart({ stockQuantity: 5 });
    repo.findById.mockResolvedValue(part);
    repo.update.mockImplementation(async (p) => p);

    const result = await useCase.execute('part-1', 3);

    expect(result.stockQuantity).toBe(8);
    expect(repo.update).toHaveBeenCalledTimes(1);
  });

  it('should throw NotFoundException when part is not found', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute('missing', 5)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw DomainException when adding zero quantity', async () => {
    const part = makePart();
    repo.findById.mockResolvedValue(part);
    await expect(useCase.execute('part-1', 0)).rejects.toThrow(DomainException);
  });
});

describe('RemoveStockUseCase', () => {
  let repo: jest.Mocked<IPartRepository>;
  let useCase: RemoveStockUseCase;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new RemoveStockUseCase(repo, makeLogger());
  });

  it('should remove stock and persist the updated part', async () => {
    const part = makePart({ stockQuantity: 10 });
    repo.findById.mockResolvedValue(part);
    repo.update.mockImplementation(async (p) => p);

    const result = await useCase.execute('part-1', 4);

    expect(result.stockQuantity).toBe(6);
    expect(repo.update).toHaveBeenCalledTimes(1);
  });

  it('should throw NotFoundException when part is not found', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute('missing', 1)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw DomainException when removing more than available stock', async () => {
    const part = makePart({ stockQuantity: 3 });
    repo.findById.mockResolvedValue(part);
    await expect(useCase.execute('part-1', 10)).rejects.toThrow(
      DomainException,
    );
  });
});

describe('ListLowStockPartsUseCase', () => {
  it('should return only low-stock parts', async () => {
    const repo = makeRepo();
    const lowStockPart = makePart({ stockQuantity: 2, minStockQuantity: 3 });
    repo.findLowStock.mockResolvedValue([lowStockPart]);

    const result = await new ListLowStockPartsUseCase(
      repo,
      makeLogger(),
    ).execute();

    expect(result).toHaveLength(1);
    expect(result[0].isLowStock).toBe(true);
  });

  it('should return an empty array when no parts are low on stock', async () => {
    const repo = makeRepo();
    repo.findLowStock.mockResolvedValue([]);

    const result = await new ListLowStockPartsUseCase(
      repo,
      makeLogger(),
    ).execute();

    expect(result).toHaveLength(0);
  });
});

describe('CreatePartUseCase', () => {
  it('should create a part when code is unique', async () => {
    const repo = makeRepo();
    repo.findByCode.mockResolvedValue(null);
    repo.create.mockImplementation(async (p) => p);

    const result = await new CreatePartUseCase(repo, makeLogger()).execute({
      name: 'Filtro de Óleo',
      code: 'FO-001',
      price: 25,
      stockQuantity: 10,
      minStockQuantity: 3,
    });
    expect(result.code).toBe('FO-001');
  });

  it('should throw ConflictException when code is already registered', async () => {
    const repo = makeRepo();
    repo.findByCode.mockResolvedValue(makePart());
    await expect(
      new CreatePartUseCase(repo, makeLogger()).execute({
        name: 'X',
        code: 'FO-001',
        price: 10,
        stockQuantity: 5,
        minStockQuantity: 1,
      }),
    ).rejects.toThrow(ConflictException);
  });
});

describe('ListPartsUseCase', () => {
  it('should return paginated parts', async () => {
    const repo = makeRepo();
    repo.findAll.mockResolvedValue({ data: [makePart()], total: 1 });

    const result = await new ListPartsUseCase(repo, makeLogger()).execute({
      page: 1,
      limit: 10,
    });
    expect(result.total).toBe(1);
    expect(result.data).toHaveLength(1);
  });
});

describe('UpdatePartUseCase', () => {
  it('should update and return the part', async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValue(makePart());
    repo.update.mockImplementation(async (p) => p);

    const result = await new UpdatePartUseCase(repo, makeLogger()).execute(
      'part-1',
      {
        name: 'Filtro Novo',
      },
    );
    expect(result.name).toBe('Filtro Novo');
  });

  it('should throw NotFoundException when part not found', async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValue(null);
    await expect(
      new UpdatePartUseCase(repo, makeLogger()).execute('missing', {}),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('DeletePartUseCase', () => {
  it('should delete a part', async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValue(makePart());
    repo.delete.mockResolvedValue();

    await expect(
      new DeletePartUseCase(repo, makeLogger()).execute('part-1'),
    ).resolves.toBeUndefined();
    expect(repo.delete).toHaveBeenCalledWith('part-1');
  });

  it('should throw NotFoundException when part not found', async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValue(null);
    await expect(
      new DeletePartUseCase(repo, makeLogger()).execute('missing'),
    ).rejects.toThrow(NotFoundException);
  });
});
