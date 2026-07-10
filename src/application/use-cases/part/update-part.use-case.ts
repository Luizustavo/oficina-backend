import { Injectable, Logger } from '@nestjs/common';
import { IPartRepository } from '@domain/repositories/part.repository.interface';
import { NotFoundException } from '@shared/exceptions/domain.exceptions';
import { UpdatePartRequestDto } from '@application/dtos/request/part.dto';
import { PartResponseDto } from '@application/dtos/response/part.dto';
import { PartMapper } from '@application/mappers/part.mapper';

@Injectable()
export class UpdatePartUseCase {
  constructor(
    private readonly partRepository: IPartRepository,
    private readonly logger: Logger,
  ) {}

  async execute(
    id: string,
    dto: UpdatePartRequestDto,
  ): Promise<PartResponseDto> {
    this.logger.log(`Updating part with ID: ${id}`);

    const part = await this.partRepository.findById(id);
    if (!part) {
      this.logger.warn(`Part not found for update with ID: ${id}`);
      throw new NotFoundException('Part', id);
    }

    part.update(dto);
    const updated = await this.partRepository.update(part);

    this.logger.log(`Part updated successfully with ID: ${id}`);

    const response: PartResponseDto = PartMapper.toResponse(updated);
    return response;
  }
}
