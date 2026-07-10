import { UpdateCustomerRequestDto } from '@application/dtos/request/customer.dto';
import { ICustomerRepository } from '@domain/repositories/customer.repository.interface';
import { CustomerResponseDto } from '@application/dtos/response/customer.dto';
import { Injectable, Logger } from '@nestjs/common';
import { NotFoundException } from '@shared/exceptions/domain.exceptions';
import { CustomerMapper } from '@application/mappers/customer.mapper';

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
    this.logger.log(`Updating customer with ID: ${id}`);

    const customer = await this.customerRepository.findById(id);
    if (!customer) {
      this.logger.warn(`Customer not found for update with ID: ${id}`);
      throw new NotFoundException('Customer', id);
    }

    customer.update(dto);
    const updated = await this.customerRepository.update(customer);

    this.logger.log(`Customer updated successfully with ID: ${id}`);

    const response: CustomerResponseDto = CustomerMapper.toResponse(updated);
    return response;
  }
}
