import { Injectable, Logger } from '@nestjs/common';
import { IServiceRepository } from '@domain/repositories/service.repository.interface';
import { ServiceResponseDto } from '@application/dtos/response/service.dto';
import { PaginatedResponseDto } from '@application/dtos/common.dto';
import { ServiceMapper } from '@application/mappers/service.mapper';
import { PaginationMapper } from '@application/mappers/pagination.mapper';

@Injectable()
export class ListServicesUseCase {
  constructor(
    private readonly serviceRepository: IServiceRepository,
    private readonly logger: Logger,
  ) {}

  async execute(params: {
    page?: number;
    limit?: number;
    onlyActive?: boolean;
  }): Promise<PaginatedResponseDto<ServiceResponseDto>> {
    this.logger.log(
      `Listing services with pagination - Page: ${params.page}, Limit: ${params.limit}`,
    );

    const { page, limit, skip } = PaginationMapper.resolveParams(params);
    const { data, total } = await this.serviceRepository.findAll({
      skip,
      take: limit,
      onlyActive: params.onlyActive,
    });

    this.logger.log(`Retrieved ${data.length} services, Total: ${total}`);

    const response: PaginatedResponseDto<ServiceResponseDto> =
      PaginationMapper.toResponse(data, total, page, limit, (service) =>
        ServiceMapper.toResponse(service),
      );
    return response;
  }
}
