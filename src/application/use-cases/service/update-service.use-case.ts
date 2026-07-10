import { Injectable, Logger } from '@nestjs/common';
import { IServiceRepository } from '@domain/repositories/service.repository.interface';
import { NotFoundException } from '@shared/exceptions/domain.exceptions';
import { UpdateServiceRequestDto } from '@application/dtos/request/service.dto';
import { ServiceResponseDto } from '@application/dtos/response/service.dto';
import { ServiceMapper } from '@application/mappers/service.mapper';

@Injectable()
export class UpdateServiceUseCase {
  constructor(
    private readonly serviceRepository: IServiceRepository,
    private readonly logger: Logger,
  ) {}

  async execute(
    id: string,
    dto: UpdateServiceRequestDto,
  ): Promise<ServiceResponseDto> {
    this.logger.log(`Updating service with ID: ${id}`);

    const service = await this.serviceRepository.findById(id);
    if (!service) {
      this.logger.warn(`Service not found for update with ID: ${id}`);
      throw new NotFoundException('Service', id);
    }

    service.update(dto);
    const updated = await this.serviceRepository.update(service);

    this.logger.log(`Service updated successfully with ID: ${id}`);

    const response: ServiceResponseDto = ServiceMapper.toResponse(updated);
    return response;
  }
}
