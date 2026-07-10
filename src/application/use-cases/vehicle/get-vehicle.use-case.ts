import { Injectable, Logger } from '@nestjs/common';
import { IVehicleRepository } from '@domain/repositories/vehicle.repository.interface';
import { NotFoundException } from '@shared/exceptions/domain.exceptions';
import { VehicleResponseDto } from '@application/dtos/response/vehicle.dto';
import { VehicleMapper } from '@application/mappers/vehicle.mapper';

@Injectable()
export class GetVehicleUseCase {
  constructor(
    private readonly vehicleRepository: IVehicleRepository,
    private readonly logger: Logger,
  ) {}

  async execute(id: string): Promise<VehicleResponseDto> {
    this.logger.log(`Retrieving vehicle with ID: ${id}`);

    const vehicle = await this.vehicleRepository.findById(id);
    if (!vehicle) {
      this.logger.warn(`Vehicle not found with ID: ${id}`);
      throw new NotFoundException('Vehicle', id);
    }

    const response: VehicleResponseDto = VehicleMapper.toResponse(vehicle);
    return response;
  }
}
