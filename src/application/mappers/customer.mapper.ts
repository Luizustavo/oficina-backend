import { CreateCustomerRequestDto } from '@application/dtos/request/customer.dto';
import { CustomerResponseDto } from '@application/dtos/response/customer.dto';
import { CustomerEntity } from '@domain/entities/customer/customer.entity';
import { randomUUID } from 'crypto';

export class CustomerMapper {
  private constructor() {
    throw new Error(
      'CustomerMapper is a static class and cannot be instantiated',
    );
  }

  public static toEntity(dto: CreateCustomerRequestDto): CustomerEntity {
    return CustomerEntity.create(
      {
        name: dto.name,
        document: dto.document.replace(/\D/g, ''),
        type: dto.type,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
      },
      randomUUID(),
    );
  }

  public static toResponse(customer: CustomerEntity): CustomerResponseDto {
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
