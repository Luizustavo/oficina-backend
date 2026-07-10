import { PaginatedResponseDto } from '@application/dtos/common.dto';
import { Injectable, Logger } from '@nestjs/common';
import { PaginationMapper } from '@application/mappers/pagination.mapper';
import { IPartRepository } from '@domain/repositories/part.repository.interface';
import { PartResponseDto } from '@application/dtos/response/part.dto';
import { PartMapper } from '@application/mappers/part.mapper';

@Injectable()
export class ListPartsUseCase {
  constructor(
    private readonly partRepository: IPartRepository,
    private readonly logger: Logger,
  ) {}

  async execute(params: {
    page?: number;
    limit?: number;
    onlyActive?: boolean;
  }): Promise<PaginatedResponseDto<PartResponseDto>> {
    this.logger.log(
      `Listing parts with pagination - Page: ${params.page}, Limit: ${params.limit}`,
    );

    const { page, limit, skip } = PaginationMapper.resolveParams(params);
    const { data, total } = await this.partRepository.findAll({
      skip,
      take: limit,
      onlyActive: params.onlyActive,
    });

    this.logger.log(`Retrieved ${data.length} parts, Total: ${total}`);

    const response: PaginatedResponseDto<PartResponseDto> =
      PaginationMapper.toResponse(data, total, page, limit, (part) =>
        PartMapper.toResponse(part),
      );
    return response;
  }
}
