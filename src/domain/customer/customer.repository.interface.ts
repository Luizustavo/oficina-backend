import { Customer } from './customer.entity';

export interface ICustomerRepository {
  create(customer: Customer): Promise<Customer>;
  findById(id: string): Promise<Customer | null>;
  findByDocument(document: string): Promise<Customer | null>;
  findAll(params: {
    skip?: number;
    take?: number;
  }): Promise<{ data: Customer[]; total: number }>;
  update(customer: Customer): Promise<Customer>;
  delete(id: string): Promise<void>;
  existsById(id: string): Promise<boolean>;
  hasServiceOrders(id: string): Promise<boolean>;
}

export const CUSTOMER_REPOSITORY = Symbol('ICustomerRepository');
