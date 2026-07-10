import { Injectable, Logger } from '@nestjs/common';
import { IServiceRepository } from '@domain/repositories/service.repository.interface';
import { ServiceResponseDto } from '@application/dtos/response/service.dto';
import { NotFoundException } from '@shared/exceptions/domain.exceptions';
import { ServiceMapper } from '@application/mappers/service.mapper';

@Injectable()
export class ToggleServiceUseCase {
  constructor(
    private readonly serviceRepository: IServiceRepository,
    private readonly logger: Logger,
  ) {}

  async execute(id: string): Promise<ServiceResponseDto> {
    this.logger.log(`Toggling active status for service with ID: ${id}`);

    const service = await this.serviceRepository.findById(id);
    if (!service) {
      this.logger.warn(`Service not found for toggle with ID: ${id}`);
      throw new NotFoundException('Service', id);
    }

    service.toggleActive();
    const updated = await this.serviceRepository.update(service);

    this.logger.log(
      `Service ${id} active status toggled to: ${updated.isActive}`,
    );

    const response: ServiceResponseDto = ServiceMapper.toResponse(updated);
    return response;
  }
}
