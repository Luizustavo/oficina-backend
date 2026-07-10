import { Injectable, Logger } from '@nestjs/common';
import { IVehicleRepository } from '@domain/repositories/vehicle.repository.interface';
import { VehicleResponseDto } from '@application/dtos/response/vehicle.dto';
import { VehicleMapper } from '@application/mappers/vehicle.mapper';

@Injectable()
export class ListVehiclesByCustomerUseCase {
  constructor(
    private readonly vehicleRepository: IVehicleRepository,
    private readonly logger: Logger,
  ) {}

  async execute(customerId: string): Promise<VehicleResponseDto[]> {
    this.logger.log(`Listing vehicles for customer: ${customerId}`);

    const vehicles = await this.vehicleRepository.findByCustomerId(customerId);

    this.logger.log(
      `Retrieved ${vehicles.length} vehicles for customer: ${customerId}`,
    );

    return vehicles.map((vehicle) => VehicleMapper.toResponse(vehicle));
  }
}
