import { Module } from '@nestjs/common';
import { CustomersController } from '../controllers/customers.controller';
import { CreateCustomerUseCase } from '../../../application/use-cases/customer/create-customer.use-case';
import {
  ListCustomersUseCase,
  GetCustomerUseCase,
  GetCustomerByDocumentUseCase,
} from '../../../application/use-cases/customer/list-customers.use-case';
import {
  UpdateCustomerUseCase,
  DeleteCustomerUseCase,
} from '../../../application/use-cases/customer/update-customer.use-case';
import { CustomerRepository } from '../../database/repositories/customer.repository';
import { CUSTOMER_REPOSITORY } from '../../../domain/customer/customer.repository.interface';

@Module({
  controllers: [CustomersController],
  providers: [
    CreateCustomerUseCase,
    ListCustomersUseCase,
    GetCustomerUseCase,
    GetCustomerByDocumentUseCase,
    UpdateCustomerUseCase,
    DeleteCustomerUseCase,
    { provide: CUSTOMER_REPOSITORY, useClass: CustomerRepository },
  ],
  exports: [{ provide: CUSTOMER_REPOSITORY, useClass: CustomerRepository }],
})
export class CustomersModule {}
