import { Injectable, Logger } from '@nestjs/common';
import { NotFoundException } from '@shared/exceptions/domain.exceptions';
import { IPartRepository } from '@domain/repositories/part.repository.interface';
import { PartResponseDto } from '@application/dtos/response/part.dto';
import { PartMapper } from '@application/mappers/part.mapper';

@Injectable()
export class GetPartUseCase {
  constructor(
    private readonly partRepository: IPartRepository,
    private readonly logger: Logger,
  ) {}

  async execute(id: string): Promise<PartResponseDto> {
    this.logger.log(`Retrieving part with ID: ${id}`);

    const part = await this.partRepository.findById(id);
    if (!part) {
      this.logger.warn(`Part not found with ID: ${id}`);
      throw new NotFoundException('Part', id);
    }

    const response: PartResponseDto = PartMapper.toResponse(part);
    return response;
  }
}
