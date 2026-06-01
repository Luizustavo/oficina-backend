import {
  GetCustomerByDocumentUseCase,
  ListCustomersUseCase,
  GetCustomerUseCase,
} from '@application/use-cases/customer/list-customers.use-case';
import {
  UpdateCustomerUseCase,
  DeleteCustomerUseCase,
} from '@application/use-cases/customer/update-customer.use-case';
import { CreateCustomerUseCase } from '@application/use-cases/customer/create-customer.use-case';
import { CustomersController } from '../controllers/customers.controller';
import { CUSTOMER_REPOSITORY } from '@domain/repositories/customer.repository.interface';
import { CustomerRepository } from '@infrastructure/database/prisma/repositories/customer.repository';
import { Module } from '@nestjs/common';

@Module({
  controllers: [CustomersController],
  providers: [
    GetCustomerByDocumentUseCase,
    UpdateCustomerUseCase,
    DeleteCustomerUseCase,
    CreateCustomerUseCase,
    ListCustomersUseCase,
    GetCustomerUseCase,
    { provide: CUSTOMER_REPOSITORY, useClass: CustomerRepository },
  ],
  exports: [{ provide: CUSTOMER_REPOSITORY, useClass: CustomerRepository }],
})
export class CustomersModule {}
