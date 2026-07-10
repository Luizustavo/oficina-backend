import { Injectable, Logger } from '@nestjs/common';
import { IServiceRepository } from '@domain/repositories/service.repository.interface';
import { CreateServiceRequestDto } from '@application/dtos/request/service.dto';
import { ServiceResponseDto } from '@application/dtos/response/service.dto';
import { ServiceMapper } from '@application/mappers/service.mapper';

@Injectable()
export class CreateServiceUseCase {
  constructor(
    private readonly serviceRepository: IServiceRepository,
    private readonly logger: Logger,
  ) {}

  async execute(dto: CreateServiceRequestDto): Promise<ServiceResponseDto> {
    this.logger.log(`Creating service with name: ${dto.name}`);

    const service = ServiceMapper.toEntity(dto);
    const created = await this.serviceRepository.create(service);

    this.logger.log(`Service created successfully with ID: ${created.id}`);

    const response: ServiceResponseDto = ServiceMapper.toResponse(created);
    return response;
  }
}
