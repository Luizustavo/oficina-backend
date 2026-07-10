import { CreateCustomerRequestDto } from '@application/dtos/request/customer.dto';
import { CustomerResponseDto } from '@application/dtos/response/customer.dto';
import { ICustomerRepository } from '@domain/repositories/customer.repository.interface';
import { Injectable, Logger } from '@nestjs/common';
import { ConflictException } from '@shared/exceptions/domain.exceptions';
import { CustomerMapper } from '@application/mappers/customer.mapper';

@Injectable()
export class CreateCustomerUseCase {
  constructor(
    private readonly customerRepository: ICustomerRepository,
    private readonly logger: Logger,
  ) {}

  async execute(dto: CreateCustomerRequestDto): Promise<CustomerResponseDto> {
    this.logger.log(`Creating customer with document: ${dto.document}`);
    const entity = CustomerMapper.toEntity(dto);
    const existing = await this.customerRepository.findByDocument(
      entity.document,
    );

    if (existing) {
      this.logger.warn(
        `Attempt to create customer with existing document: ${dto.document}`,
      );
      throw new ConflictException(
        `Document "${dto.document}" is already registered`,
      );
    }

    this.logger.log(
      `No existing customer found with document: ${dto.document}, proceeding to create`,
    );

    const created = await this.customerRepository.create(entity);

    if (!created) {
      this.logger.error(
        `Failed to create customer with document: ${dto.document}`,
      );
      throw new Error('Failed to create customer');
    }

    this.logger.log(`Customer created successfully with ID: ${created.id}`);
    const response: CustomerResponseDto = CustomerMapper.toResponse(created);
    this.logger.log('Use case execution completed successfully');
    return response;
  }
}
