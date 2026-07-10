import { ICustomerRepository } from '@domain/repositories/customer.repository.interface';
import { CustomerResponseDto } from '@application/dtos/response/customer.dto';
import { Injectable, Logger } from '@nestjs/common';
import { NotFoundException } from '@shared/exceptions/domain.exceptions';
import { CustomerMapper } from '@application/mappers/customer.mapper';

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
