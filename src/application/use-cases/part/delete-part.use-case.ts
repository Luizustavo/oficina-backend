import { Injectable, Logger } from '@nestjs/common';
import { IPartRepository } from '@domain/repositories/part.repository.interface';
import { NotFoundException } from '@shared/exceptions/domain.exceptions';

@Injectable()
export class DeletePartUseCase {
  constructor(
    private readonly partRepository: IPartRepository,
    private readonly logger: Logger,
  ) {}

  async execute(id: string): Promise<void> {
    this.logger.log(`Deleting part with ID: ${id}`);

    const part = await this.partRepository.findById(id);
    if (!part) {
      this.logger.warn(`Part not found for deletion with ID: ${id}`);
      throw new NotFoundException('Part', id);
    }

    await this.partRepository.delete(id);
    this.logger.log(`Part deleted successfully with ID: ${id}`);
  }
}
