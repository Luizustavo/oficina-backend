import {
  PaginatedResponseDto,
  PaginatedRequestDto,
} from '@application/dtos/common.dto';
import { ICustomerRepository } from '@domain/repositories/customer.repository.interface';
import { CustomerResponseDto } from '@application/dtos/response/customer.dto';
import { Injectable, Logger } from '@nestjs/common';
import { NotFoundException } from '@shared/exceptions/domain.exceptions';
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

    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const { data, total } = await this.customerRepository.findAll({
      skip,
      take: limit,
    });

    this.logger.log(
      `Retrieved ${data.length} customers from repository, Total customers: ${total}`,
    );

    return {
      data: data.map((c) => CustomerMapper.toResponse(c)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}

@Injectable()
export class GetCustomerUseCase {
  constructor(
    private readonly customerRepository: ICustomerRepository,
    private readonly logger: Logger,
  ) {}

  async execute(id: string): Promise<CustomerResponseDto> {
    this.logger.log(`Retrieving customer with ID: ${id}`);
    const customer = await this.customerRepository.findById(id);
    if (!customer) {
      throw new NotFoundException('Customer', id);
    }

    const response: CustomerResponseDto = CustomerMapper.toResponse(customer);

    this.logger.log(`Customer retrieved successfully with ID: ${id}`);

    return response;
  }
}

@Injectable()
export class GetCustomerByDocumentUseCase {
  constructor(
    private readonly customerRepository: ICustomerRepository,
    private readonly logger: Logger,
  ) {}

  async execute(document: string): Promise<CustomerResponseDto> {
    this.logger.log(`Retrieving customer by document: ${document}`);
    const cleaned = document.replace(/\D/g, '');
    const customer = await this.customerRepository.findByDocument(cleaned);
    if (!customer) {
      throw new NotFoundException('Customer', cleaned);
    }
    const response: CustomerResponseDto = CustomerMapper.toResponse(customer);
    this.logger.log(`Customer retrieved successfully by document: ${document}`);
    return response;
  }
}
