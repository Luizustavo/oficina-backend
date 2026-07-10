import {
  BusinessRuleException,
  NotFoundException,
} from '@shared/exceptions/domain.exceptions';
import { ICustomerRepository } from '@domain/repositories/customer.repository.interface';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class DeleteCustomerUseCase {
  constructor(
    private readonly customerRepository: ICustomerRepository,
    private readonly logger: Logger,
  ) {}

  async execute(id: string): Promise<void> {
    this.logger.log(`Deleting customer with ID: ${id}`);

    const exists = await this.customerRepository.existsById(id);
    if (!exists) {
      this.logger.warn(`Customer not found for deletion with ID: ${id}`);
      throw new NotFoundException('Customer', id);
    }

    const hasOrders = await this.customerRepository.hasServiceOrders(id);
    if (hasOrders) {
      this.logger.warn(
        `Attempt to delete customer with associated service orders: ${id}`,
      );
      throw new BusinessRuleException(
        'Cannot delete customer with associated service orders',
      );
    }

    await this.customerRepository.delete(id);
    this.logger.log(`Customer deleted successfully with ID: ${id}`);
  }
}
