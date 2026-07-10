import { PaginatedResponseDto } from '@application/dtos/common.dto';
import { Injectable, Logger } from '@nestjs/common';
import { IVehicleRepository } from '@domain/repositories/vehicle.repository.interface';
import { VehicleResponseDto } from '@application/dtos/response/vehicle.dto';
import { PaginationMapper } from '@application/mappers/pagination.mapper';
import { VehicleMapper } from '@application/mappers/vehicle.mapper';

@Injectable()
export class ListVehiclesUseCase {
  constructor(
    private readonly vehicleRepository: IVehicleRepository,
    private readonly logger: Logger,
  ) {}

  async execute(params: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponseDto<VehicleResponseDto>> {
    this.logger.log(
      `Listing vehicles with pagination - Page: ${params.page}, Limit: ${params.limit}`,
    );

    const { page, limit, skip } = PaginationMapper.resolveParams(params);
    const { data, total } = await this.vehicleRepository.findAll({
      skip,
      take: limit,
    });

    this.logger.log(`Retrieved ${data.length} vehicles, Total: ${total}`);

    const response: PaginatedResponseDto<VehicleResponseDto> =
      PaginationMapper.toResponse(data, total, page, limit, (vehicle) =>
        VehicleMapper.toResponse(vehicle),
      );
    return response;
  }
}
