import { ICustomerRepository } from '@domain/repositories/customer.repository.interface';
import { CustomerResponseDto } from '@application/dtos/response/customer.dto';
import { Injectable, Logger } from '@nestjs/common';
import { NotFoundException } from '@shared/exceptions/domain.exceptions';
import { CustomerMapper } from '@application/mappers/customer.mapper';

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
