import { Injectable, Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  ICustomerRepository,
  CUSTOMER_REPOSITORY,
} from '../../../domain/customer/customer.repository.interface';
import { Customer } from '../../../domain/customer/customer.entity';
import { ConflictException } from '../../../shared/exceptions/domain.exceptions';
import { CreateCustomerRequestDto } from '../../dtos/request/customer.dto';
import { CustomerResponseDto } from '../../dtos/response/customer.dto';

export type { CustomerResponseDto };

@Injectable()
export class CreateCustomerUseCase {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: ICustomerRepository,
  ) {}

  async execute(dto: CreateCustomerRequestDto): Promise<CustomerResponseDto> {
    const existing = await this.customerRepository.findByDocument(dto.document);
    if (existing) {
      throw new ConflictException(
        `Document "${dto.document}" is already registered`,
      );
    }

    const customer = Customer.create({
      id: randomUUID(),
      name: dto.name,
      document: dto.document.replace(/\D/g, ''),
      type: dto.type,
      email: dto.email,
      phone: dto.phone,
      address: dto.address,
    });

    const created = await this.customerRepository.create(customer);
    return this.toResponse(created);
  }

  toResponse(customer: Customer): CustomerResponseDto {
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
