import { CreatePartRequestDto } from '@application/dtos/request/part.dto';
import { Injectable, Logger } from '@nestjs/common';
import { ConflictException } from '@shared/exceptions/domain.exceptions';
import { IPartRepository } from '@domain/repositories/part.repository.interface';
import { PartResponseDto } from '@application/dtos/response/part.dto';
import { PartMapper } from '@application/mappers/part.mapper';

@Injectable()
export class CreatePartUseCase {
  constructor(
    private readonly partRepository: IPartRepository,
    private readonly logger: Logger,
  ) {}

  async execute(dto: CreatePartRequestDto): Promise<PartResponseDto> {
    this.logger.log(`Creating part with code: ${dto.code}`);

    const existing = await this.partRepository.findByCode(dto.code);
    if (existing) {
      this.logger.warn(
        `Attempt to create part with existing code: ${dto.code}`,
      );
      throw new ConflictException(
        `Part code "${dto.code}" is already registered`,
      );
    }

    const part = PartMapper.toEntity(dto);
    const created = await this.partRepository.create(part);

    this.logger.log(`Part created successfully with ID: ${created.id}`);

    const response: PartResponseDto = PartMapper.toResponse(created);
    return response;
  }
}
