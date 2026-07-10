import { Injectable, Logger } from '@nestjs/common';
import { IPartRepository } from '@domain/repositories/part.repository.interface';
import { PartResponseDto } from '@application/dtos/response/part.dto';
import { PartMapper } from '@application/mappers/part.mapper';

@Injectable()
export class ListLowStockPartsUseCase {
  constructor(
    private readonly partRepository: IPartRepository,
    private readonly logger: Logger,
  ) {}

  async execute(): Promise<PartResponseDto[]> {
    this.logger.log('Listing parts with low stock');

    const parts = await this.partRepository.findLowStock();

    this.logger.log(`Retrieved ${parts.length} low-stock parts`);

    const response: PartResponseDto[] = parts.map((part) =>
      PartMapper.toResponse(part),
    );
    return response;
  }
}
