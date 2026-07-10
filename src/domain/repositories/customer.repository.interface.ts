import { CustomerEntity } from '@domain/entities/customer/customer.entity';

export abstract class ICustomerRepository {
  abstract hasServiceOrders(id: string): Promise<boolean>;
  abstract findByDocument(document: string): Promise<CustomerEntity | null>;
  abstract existsById(id: string): Promise<boolean>;
  abstract findById(id: string): Promise<CustomerEntity | null>;
  abstract create(customer: CustomerEntity): Promise<CustomerEntity>;
  abstract update(customer: CustomerEntity): Promise<CustomerEntity>;
  abstract delete(id: string): Promise<void>;
  abstract findAll(params: {
    skip?: number;
    take?: number;
  }): Promise<{ data: CustomerEntity[]; total: number }>;
}
