import { CustomerEntity } from '../entities/customer/customer.entity';

export interface ICustomerRepository {
  create(customer: CustomerEntity): Promise<CustomerEntity>;
  findById(id: string): Promise<CustomerEntity | null>;
  findByDocument(document: string): Promise<CustomerEntity | null>;
  findAll(params: {
    skip?: number;
    take?: number;
  }): Promise<{ data: CustomerEntity[]; total: number }>;
  update(customer: CustomerEntity): Promise<CustomerEntity>;
  delete(id: string): Promise<void>;
  existsById(id: string): Promise<boolean>;
  hasServiceOrders(id: string): Promise<boolean>;
}

export const CUSTOMER_REPOSITORY = Symbol('ICustomerRepository');
