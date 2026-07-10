import {
  BusinessRuleException,
  NotFoundException,
} from '@shared/exceptions/domain.exceptions';
import { UpdateCustomerRequestDto } from '@application/dtos/request/customer.dto';
import { ICustomerRepository } from '@domain/repositories/customer.repository.interface';
import { CustomerResponseDto } from '@application/dtos/response/customer.dto';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class UpdateCustomerUseCase {
  constructor(
    private readonly customerRepository: ICustomerRepository,
    private readonly logger: Logger,
  ) {}

  async execute(
    id: string,
    dto: UpdateCustomerRequestDto,
  ): Promise<CustomerResponseDto> {
    const customer = await this.customerRepository.findById(id);
    if (!customer) {
      throw new NotFoundException('Customer', id);
    }

    customer.update(dto);
    const updated = await this.customerRepository.update(customer);

    return {
      id: updated.id,
      name: updated.name,
      document: updated.document,
      type: updated.type,
      email: updated.email,
      phone: updated.phone,
      address: updated.address,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }
}

@Injectable()
export class DeleteCustomerUseCase {
  constructor(private readonly customerRepository: ICustomerRepository) {}

  async execute(id: string): Promise<void> {
    const exists = await this.customerRepository.existsById(id);
    if (!exists) {
      throw new NotFoundException('Customer', id);
    }

    const hasOrders = await this.customerRepository.hasServiceOrders(id);
    if (hasOrders) {
      throw new BusinessRuleException(
        'Cannot delete customer with associated service orders',
      );
    }

    await this.customerRepository.delete(id);
  }
}
