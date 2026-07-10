import { Injectable, Logger } from '@nestjs/common';
import { IVehicleRepository } from '@domain/repositories/vehicle.repository.interface';
import { ICustomerRepository } from '@domain/repositories/customer.repository.interface';
import { VehicleEntity } from '@domain/entities/vehicle/vehicle.entity';
import {
  ConflictException,
  NotFoundException,
} from '@shared/exceptions/domain.exceptions';
import { CreateVehicleRequestDto } from '@application/dtos/request/vehicle.dto';
import { VehicleResponseDto } from '@application/dtos/response/vehicle.dto';
import { VehicleMapper } from '@application/mappers/vehicle.mapper';

@Injectable()
export class CreateVehicleUseCase {
  constructor(
    private readonly vehicleRepository: IVehicleRepository,
    private readonly customerRepository: ICustomerRepository,
    private readonly logger: Logger,
  ) {}

  async execute(dto: CreateVehicleRequestDto): Promise<VehicleResponseDto> {
    this.logger.log(`Creating vehicle with license plate: ${dto.licensePlate}`);

    const customerExists = await this.customerRepository.existsById(
      dto.customerId,
    );
    if (!customerExists) {
      this.logger.warn(
        `Attempt to create vehicle for missing customer: ${dto.customerId}`,
      );
      throw new NotFoundException('Customer', dto.customerId);
    }

    const normalized = dto.licensePlate.toUpperCase().replace(/-/g, '').trim();
    const existing =
      await this.vehicleRepository.findByLicensePlate(normalized);
    if (existing) {
      this.logger.warn(
        `Attempt to create vehicle with existing license plate: ${dto.licensePlate}`,
      );
      throw new ConflictException(
        `License plate "${dto.licensePlate}" is already registered`,
      );
    }

    const vehicle = VehicleEntity.create({
      customerId: dto.customerId,
      licensePlate: dto.licensePlate,
      brand: dto.brand,
      model: dto.model,
      year: dto.year,
      color: dto.color,
    });

    const created = await this.vehicleRepository.create(vehicle);

    this.logger.log(`Vehicle created successfully with ID: ${created.id}`);

    const response: VehicleResponseDto = VehicleMapper.toResponse(created);
    return response;
  }
}
