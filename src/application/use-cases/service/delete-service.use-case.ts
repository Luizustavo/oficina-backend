import { Injectable, Logger } from '@nestjs/common';
import { IServiceRepository } from '@domain/repositories/service.repository.interface';
import { NotFoundException } from '@shared/exceptions/domain.exceptions';

@Injectable()
export class DeleteServiceUseCase {
  constructor(
    private readonly serviceRepository: IServiceRepository,
    private readonly logger: Logger,
  ) {}

  async execute(id: string): Promise<void> {
    this.logger.log(`Deleting service with ID: ${id}`);

    const service = await this.serviceRepository.findById(id);
    if (!service) {
      this.logger.warn(`Service not found for deletion with ID: ${id}`);
      throw new NotFoundException('Service', id);
    }

    await this.serviceRepository.delete(id);
    this.logger.log(`Service deleted successfully with ID: ${id}`);
  }
}
