import { Injectable, Logger } from '@nestjs/common';
import { IServiceRepository } from '@domain/repositories/service.repository.interface';
import { NotFoundException } from '@shared/exceptions/domain.exceptions';
import { ServiceResponseDto } from '@application/dtos/response/service.dto';
import { ServiceMapper } from '@application/mappers/service.mapper';

@Injectable()
export class GetServiceUseCase {
  constructor(
    private readonly serviceRepository: IServiceRepository,
    private readonly logger: Logger,
  ) {}

  async execute(id: string): Promise<ServiceResponseDto> {
    this.logger.log(`Retrieving service with ID: ${id}`);

    const service = await this.serviceRepository.findById(id);
    if (!service) {
      this.logger.warn(`Service not found with ID: ${id}`);
      throw new NotFoundException('Service', id);
    }

    const response: ServiceResponseDto = ServiceMapper.toResponse(service);
    return response;
  }
}
