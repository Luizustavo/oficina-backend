import {
  PaginatedResponseDto,
  PaginatedRequestDto,
} from '@application/dtos/common.dto';
import { ICustomerRepository } from '@domain/repositories/customer.repository.interface';
import { CustomerResponseDto } from '@application/dtos/response/customer.dto';
import { Injectable, Logger } from '@nestjs/common';
import { PaginationMapper } from '@application/mappers/pagination.mapper';
import { CustomerMapper } from '@application/mappers/customer.mapper';

@Injectable()
export class ListCustomersUseCase {
  constructor(
    private readonly customerRepository: ICustomerRepository,
    private readonly logger: Logger,
  ) {}

  async execute(
    dto: PaginatedRequestDto,
  ): Promise<PaginatedResponseDto<CustomerResponseDto>> {
    this.logger.log(
      `Listing customers with pagination - Page: ${dto.page}, Limit: ${dto.limit}`,
    );

    const { page, limit, skip } = PaginationMapper.resolveParams(dto);

    const { data, total } = await this.customerRepository.findAll({
      skip,
      take: limit,
    });

    this.logger.log(
      `Retrieved ${data.length} customers from repository, Total customers: ${total}`,
    );

    const response: PaginatedResponseDto<CustomerResponseDto> =
      PaginationMapper.toResponse(data, total, page, limit, (c) =>
        CustomerMapper.toResponse(c),
      );
    return response;
  }
}
