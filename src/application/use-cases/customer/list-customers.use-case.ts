import { Injectable, Inject } from '@nestjs/common';
import {
  ICustomerRepository,
  CUSTOMER_REPOSITORY,
} from '../../../domain/repositories/customer.repository.interface';
import { CustomerEntity } from '../../../domain/entities/customer/customer.entity';
import { NotFoundException } from '../../../shared/exceptions/domain.exceptions';
import { CustomerResponseDto } from '../../dtos/response/customer.dto';
import { PaginatedResponseDto } from '../../dtos/common.dto';

@Injectable()
export class ListCustomersUseCase {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: ICustomerRepository,
  ) {}

  async execute(
    dto: { page?: number; limit?: number } = {},
  ): Promise<PaginatedResponseDto<CustomerResponseDto>> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const { data, total } = await this.customerRepository.findAll({
      skip,
      take: limit,
    });

    return {
      data: data.map((c) => this.toResponse(c)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private toResponse(customer: CustomerEntity): CustomerResponseDto {
    return {
      id: customer.id,
      name: customer.name,
      document: customer.document,
      type: customer.type,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };
  }
}

@Injectable()
export class GetCustomerUseCase {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: ICustomerRepository,
  ) {}

  async execute(id: string): Promise<CustomerResponseDto> {
    const customer = await this.customerRepository.findById(id);
    if (!customer) {
      throw new NotFoundException('Customer', id);
    }
    return {
      id: customer.id,
      name: customer.name,
      document: customer.document,
      type: customer.type,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };
  }
}

@Injectable()
export class GetCustomerByDocumentUseCase {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: ICustomerRepository,
  ) {}

  async execute(document: string): Promise<CustomerResponseDto> {
    const cleaned = document.replace(/\D/g, '');
    const customer = await this.customerRepository.findByDocument(cleaned);
    if (!customer) {
      throw new NotFoundException('Customer', cleaned);
    }
    return {
      id: customer.id,
      name: customer.name,
      document: customer.document,
      type: customer.type,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };
  }
}
