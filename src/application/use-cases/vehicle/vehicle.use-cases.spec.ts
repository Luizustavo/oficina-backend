import {
  ConflictException,
  NotFoundException,
} from '@shared/exceptions/domain.exceptions';
import { ListVehiclesByCustomerUseCase } from './list-vehicles-by-customer.use-case';
import { CreateVehicleUseCase } from './create-vehicle.use-case';
import { DeleteVehicleUseCase } from './delete-vehicle.use-case';
import { ICustomerRepository } from '@domain/repositories/customer.repository.interface';
import { IVehicleRepository } from '@domain/repositories/vehicle.repository.interface';
import { GetVehicleUseCase } from './get-vehicle.use-case';
import { VehicleEntity } from '@domain/entities/vehicle/vehicle.entity';
import { Logger } from '@nestjs/common';

const makeVehicleRepo = (): jest.Mocked<IVehicleRepository> => ({
  create: jest.fn(),
  findById: jest.fn(),
  findByLicensePlate: jest.fn(),
  findByCustomerId: jest.fn(),
  findAll: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  hasServiceOrders: jest.fn(),
});

const makeCustomerRepo = (): jest.Mocked<
  Pick<ICustomerRepository, 'existsById'>
> => ({
  existsById: jest.fn(),
});

const makeLogger = (): jest.Mocked<Logger> =>
  ({
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }) as unknown as jest.Mocked<Logger>;

const makeVehicle = () =>
  VehicleEntity.reconstitute(
    {
      customerId: 'c-1',
      licensePlate: 'ABC1234',
      brand: 'Toyota',
      model: 'Corolla',
      year: 2020,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    'v-1',
  );

describe('CreateVehicleUseCase', () => {
  const validDto = {
    customerId: 'c-1',
    licensePlate: 'ABC1234',
    brand: 'Toyota',
    model: 'Corolla',
    year: 2020,
  };

  it('should create a vehicle when customer exists and plate is unique', async () => {
    const vehicleRepo = makeVehicleRepo();
    const customerRepo = makeCustomerRepo() as any;
    customerRepo.existsById = jest.fn().mockResolvedValue(true);
    vehicleRepo.findByLicensePlate.mockResolvedValue(null);
    vehicleRepo.create.mockImplementation(async (v) => v);

    const result = await new CreateVehicleUseCase(
      vehicleRepo,
      customerRepo,
      makeLogger(),
    ).execute(validDto);
    expect(result.licensePlate).toBe('ABC1234');
  });

  it('should throw NotFoundException when customer does not exist', async () => {
    const vehicleRepo = makeVehicleRepo();
    const customerRepo = {
      existsById: jest.fn().mockResolvedValue(false),
    } as any;

    await expect(
      new CreateVehicleUseCase(vehicleRepo, customerRepo, makeLogger()).execute(
        validDto,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw ConflictException when license plate is already registered', async () => {
    const vehicleRepo = makeVehicleRepo();
    const customerRepo = {
      existsById: jest.fn().mockResolvedValue(true),
    } as any;
    vehicleRepo.findByLicensePlate.mockResolvedValue(makeVehicle());

    await expect(
      new CreateVehicleUseCase(vehicleRepo, customerRepo, makeLogger()).execute(
        validDto,
      ),
    ).rejects.toThrow(ConflictException);
  });
});

describe('GetVehicleUseCase', () => {
  it('should return a vehicle by id', async () => {
    const repo = makeVehicleRepo();
    repo.findById.mockResolvedValue(makeVehicle());

    const result = await new GetVehicleUseCase(repo, makeLogger()).execute(
      'v-1',
    );
    expect(result.id).toBe('v-1');
  });

  it('should throw NotFoundException when not found', async () => {
    const repo = makeVehicleRepo();
    repo.findById.mockResolvedValue(null);
    await expect(
      new GetVehicleUseCase(repo, makeLogger()).execute('missing'),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('ListVehiclesByCustomerUseCase', () => {
  it('should return vehicles for a customer', async () => {
    const repo = makeVehicleRepo();
    repo.findByCustomerId.mockResolvedValue([makeVehicle()]);

    const result = await new ListVehiclesByCustomerUseCase(
      repo,
      makeLogger(),
    ).execute('c-1');
    expect(result).toHaveLength(1);
    expect(result[0].customerId).toBe('c-1');
  });
});

describe('DeleteVehicleUseCase', () => {
  it('should delete a vehicle without service orders', async () => {
    const repo = makeVehicleRepo();
    repo.findById.mockResolvedValue(makeVehicle());
    repo.hasServiceOrders.mockResolvedValue(false);
    repo.delete.mockResolvedValue();

    await expect(
      new DeleteVehicleUseCase(repo, makeLogger()).execute('v-1'),
    ).resolves.toBeUndefined();
  });

  it('should throw when vehicle has service orders', async () => {
    const repo = makeVehicleRepo();
    repo.findById.mockResolvedValue(makeVehicle());
    repo.hasServiceOrders.mockResolvedValue(true);

    await expect(
      new DeleteVehicleUseCase(repo, makeLogger()).execute('v-1'),
    ).rejects.toThrow();
  });
});
