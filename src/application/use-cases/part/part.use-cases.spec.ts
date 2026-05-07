import {
  AddStockUseCase,
  RemoveStockUseCase,
  GetPartUseCase,
  ListLowStockPartsUseCase,
  CreatePartUseCase,
  ListPartsUseCase,
  UpdatePartUseCase,
  DeletePartUseCase,
} from './part.use-cases';
import { IPartRepository } from '../../../domain/part/part.repository.interface';
import { Part } from '../../../domain/part/part.entity';
import {
  NotFoundException,
  DomainException,
  ConflictException,
} from '../../../shared/exceptions/domain.exceptions';

const makeRepo = (): jest.Mocked<IPartRepository> => ({
  create: jest.fn(),
  findById: jest.fn(),
  findByCode: jest.fn(),
  findAll: jest.fn(),
  findLowStock: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});

const makePart = (overrides: Partial<Parameters<typeof Part.create>[0]> = {}) =>
  Part.create({
    id: 'part-1',
    name: 'Filtro de Óleo',
    code: 'FO-001',
    price: 25.9,
    stockQuantity: 10,
    minStockQuantity: 3,
    ...overrides,
  });

describe('GetPartUseCase', () => {
  it('should return the part when found', async () => {
    const repo = makeRepo();
    const part = makePart();
    repo.findById.mockResolvedValue(part);

    const result = await new GetPartUseCase(repo).execute('part-1');

    expect(result.id).toBe('part-1');
    expect(result.name).toBe('Filtro de Óleo');
  });

  it('should throw NotFoundException when part is not found', async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValue(null);

    await expect(new GetPartUseCase(repo).execute('missing')).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('AddStockUseCase', () => {
  let repo: jest.Mocked<IPartRepository>;
  let useCase: AddStockUseCase;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new AddStockUseCase(repo);
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
    useCase = new RemoveStockUseCase(repo);
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

    const result = await new ListLowStockPartsUseCase(repo).execute();

    expect(result).toHaveLength(1);
    expect(result[0].isLowStock).toBe(true);
  });

  it('should return an empty array when no parts are low on stock', async () => {
    const repo = makeRepo();
    repo.findLowStock.mockResolvedValue([]);

    const result = await new ListLowStockPartsUseCase(repo).execute();

    expect(result).toHaveLength(0);
  });
});

describe('CreatePartUseCase', () => {
  it('should create a part when code is unique', async () => {
    const repo = makeRepo();
    repo.findByCode.mockResolvedValue(null);
    repo.create.mockImplementation(async (p) => p);

    const result = await new CreatePartUseCase(repo).execute({
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
      new CreatePartUseCase(repo).execute({
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

    const result = await new ListPartsUseCase(repo).execute({
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

    const result = await new UpdatePartUseCase(repo).execute('part-1', {
      name: 'Filtro Novo',
    });
    expect(result.name).toBe('Filtro Novo');
  });

  it('should throw NotFoundException when part not found', async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValue(null);
    await expect(
      new UpdatePartUseCase(repo).execute('missing', {}),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('DeletePartUseCase', () => {
  it('should delete a part', async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValue(makePart());
    repo.delete.mockResolvedValue();

    await expect(
      new DeletePartUseCase(repo).execute('part-1'),
    ).resolves.toBeUndefined();
    expect(repo.delete).toHaveBeenCalledWith('part-1');
  });

  it('should throw NotFoundException when part not found', async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValue(null);
    await expect(
      new DeletePartUseCase(repo).execute('missing'),
    ).rejects.toThrow(NotFoundException);
  });
});
