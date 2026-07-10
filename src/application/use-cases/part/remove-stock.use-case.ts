import { Injectable, Logger } from '@nestjs/common';
import { IPartRepository } from '@domain/repositories/part.repository.interface';
import { NotFoundException } from '@shared/exceptions/domain.exceptions';
import { PartResponseDto } from '@application/dtos/response/part.dto';
import { PartMapper } from '@application/mappers/part.mapper';

@Injectable()
export class RemoveStockUseCase {
  constructor(
    private readonly partRepository: IPartRepository,
    private readonly logger: Logger,
  ) {}

  async execute(id: string, quantity: number): Promise<PartResponseDto> {
    this.logger.log(
      `Removing ${quantity} units of stock from part with ID: ${id}`,
    );

    const part = await this.partRepository.findById(id);
    if (!part) {
      this.logger.warn(`Part not found for stock removal with ID: ${id}`);
      throw new NotFoundException('Part', id);
    }

    part.removeStock(quantity);
    const updated = await this.partRepository.update(part);

    this.logger.log(`Stock removed successfully from part with ID: ${id}`);

    const response: PartResponseDto = PartMapper.toResponse(updated);
    return response;
  }
}
