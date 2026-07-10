import { Injectable, Logger } from '@nestjs/common';
import { IVehicleRepository } from '@domain/repositories/vehicle.repository.interface';
import { NotFoundException } from '@shared/exceptions/domain.exceptions';
import { UpdateVehicleRequestDto } from '@application/dtos/request/vehicle.dto';
import { VehicleResponseDto } from '@application/dtos/response/vehicle.dto';
import { VehicleMapper } from '@application/mappers/vehicle.mapper';

@Injectable()
export class UpdateVehicleUseCase {
  constructor(
    private readonly vehicleRepository: IVehicleRepository,
    private readonly logger: Logger,
  ) {}

  async execute(
    id: string,
    dto: UpdateVehicleRequestDto,
  ): Promise<VehicleResponseDto> {
    this.logger.log(`Updating vehicle with ID: ${id}`);

    const vehicle = await this.vehicleRepository.findById(id);
    if (!vehicle) {
      this.logger.warn(`Vehicle not found for update with ID: ${id}`);
      throw new NotFoundException('Vehicle', id);
    }

    vehicle.update(dto);
    const updated = await this.vehicleRepository.update(vehicle);

    this.logger.log(`Vehicle updated successfully with ID: ${id}`);

    const response: VehicleResponseDto = VehicleMapper.toResponse(updated);
    return response;
  }
}
