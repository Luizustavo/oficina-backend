import { Injectable, Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  IVehicleRepository,
  VEHICLE_REPOSITORY,
} from '../../../domain/vehicle/vehicle.repository.interface';
import {
  ICustomerRepository,
  CUSTOMER_REPOSITORY,
} from '../../../domain/customer/customer.repository.interface';
import { Vehicle } from '../../../domain/vehicle/vehicle.entity';
import {
  ConflictException,
  NotFoundException,
} from '../../../shared/exceptions/domain.exceptions';
import {
  CreateVehicleRequestDto,
  UpdateVehicleRequestDto,
} from '../../dtos/request/vehicle.dto';
import { VehicleResponseDto } from '../../dtos/response/vehicle.dto';
import { PaginatedResponseDto } from '../../dtos/common.dto';

@Injectable()
export class CreateVehicleUseCase {
  constructor(
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: IVehicleRepository,
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: ICustomerRepository,
  ) {}

  async execute(dto: CreateVehicleRequestDto): Promise<VehicleResponseDto> {
    const customerExists = await this.customerRepository.existsById(
      dto.customerId,
    );
    if (!customerExists) {
      throw new NotFoundException('Customer', dto.customerId);
    }

    const normalized = dto.licensePlate.toUpperCase().replace(/-/g, '').trim();
    const existing =
      await this.vehicleRepository.findByLicensePlate(normalized);
    if (existing) {
      throw new ConflictException(
        `License plate "${dto.licensePlate}" is already registered`,
      );
    }

    const vehicle = Vehicle.create({
      id: randomUUID(),
      customerId: dto.customerId,
      licensePlate: dto.licensePlate,
      brand: dto.brand,
      model: dto.model,
      year: dto.year,
      color: dto.color,
    });

    const created = await this.vehicleRepository.create(vehicle);
    return this.toResponse(created);
  }

  toResponse(vehicle: Vehicle): VehicleResponseDto {
    return {
      id: vehicle.id,
      customerId: vehicle.customerId,
      licensePlate: vehicle.licensePlate,
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      color: vehicle.color,
      createdAt: vehicle.createdAt,
      updatedAt: vehicle.updatedAt,
    };
  }
}

@Injectable()
export class GetVehicleUseCase {
  constructor(
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: IVehicleRepository,
  ) {}

  async execute(id: string): Promise<VehicleResponseDto> {
    const vehicle = await this.vehicleRepository.findById(id);
    if (!vehicle) throw new NotFoundException('Vehicle', id);
    return {
      id: vehicle.id,
      customerId: vehicle.customerId,
      licensePlate: vehicle.licensePlate,
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      color: vehicle.color,
      createdAt: vehicle.createdAt,
      updatedAt: vehicle.updatedAt,
    };
  }
}

@Injectable()
export class ListVehiclesUseCase {
  constructor(
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: IVehicleRepository,
  ) {}

  async execute(params: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponseDto<VehicleResponseDto>> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const skip = (page - 1) * limit;
    const { data, total } = await this.vehicleRepository.findAll({
      skip,
      take: limit,
    });
    return {
      data: data.map((v) => ({
        id: v.id,
        customerId: v.customerId,
        licensePlate: v.licensePlate,
        brand: v.brand,
        model: v.model,
        year: v.year,
        color: v.color,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}

@Injectable()
export class ListVehiclesByCustomerUseCase {
  constructor(
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: IVehicleRepository,
  ) {}

  async execute(customerId: string): Promise<VehicleResponseDto[]> {
    const vehicles = await this.vehicleRepository.findByCustomerId(customerId);
    return vehicles.map((v) => ({
      id: v.id,
      customerId: v.customerId,
      licensePlate: v.licensePlate,
      brand: v.brand,
      model: v.model,
      year: v.year,
      color: v.color,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    }));
  }
}

@Injectable()
export class UpdateVehicleUseCase {
  constructor(
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: IVehicleRepository,
  ) {}

  async execute(
    id: string,
    dto: UpdateVehicleRequestDto,
  ): Promise<VehicleResponseDto> {
    const vehicle = await this.vehicleRepository.findById(id);
    if (!vehicle) throw new NotFoundException('Vehicle', id);
    vehicle.update(dto);
    const updated = await this.vehicleRepository.update(vehicle);
    return {
      id: updated.id,
      customerId: updated.customerId,
      licensePlate: updated.licensePlate,
      brand: updated.brand,
      model: updated.model,
      year: updated.year,
      color: updated.color,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }
}

@Injectable()
export class DeleteVehicleUseCase {
  constructor(
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: IVehicleRepository,
  ) {}

  async execute(id: string): Promise<void> {
    const vehicle = await this.vehicleRepository.findById(id);
    if (!vehicle) throw new NotFoundException('Vehicle', id);
    const hasOrders = await this.vehicleRepository.hasServiceOrders(id);
    if (hasOrders)
      throw new NotFoundException(
        'Cannot delete vehicle with associated service orders',
        id,
      );
    await this.vehicleRepository.delete(id);
  }
}
