import { Injectable, Logger } from '@nestjs/common';
import { NotFoundException } from '@shared/exceptions/domain.exceptions';
import { IPartRepository } from '@domain/repositories/part.repository.interface';
import { PartResponseDto } from '@application/dtos/response/part.dto';
import { PartMapper } from '@application/mappers/part.mapper';

@Injectable()
export class AddStockUseCase {
  constructor(
    private readonly partRepository: IPartRepository,
    private readonly logger: Logger,
  ) {}

  async execute(id: string, quantity: number): Promise<PartResponseDto> {
    this.logger.log(`Adding ${quantity} units of stock to part with ID: ${id}`);

    const part = await this.partRepository.findById(id);
    if (!part) {
      this.logger.warn(`Part not found for stock addition with ID: ${id}`);
      throw new NotFoundException('Part', id);
    }

    part.addStock(quantity);
    const updated = await this.partRepository.update(part);

    this.logger.log(`Stock added successfully to part with ID: ${id}`);

    const response: PartResponseDto = PartMapper.toResponse(updated);
    return response;
  }
}
