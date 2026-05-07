import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ICustomerRepository } from '../../../domain/customer/customer.repository.interface';
import { Customer } from '../../../domain/customer/customer.entity';
import { CustomerType } from '../../../domain/customer/customer-type.enum';

@Injectable()
export class CustomerRepository implements ICustomerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(customer: Customer): Promise<Customer> {
    const data = await this.prisma.customer.create({
      data: {
        id: customer.id,
        name: customer.name,
        document: customer.document,
        type: customer.type,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
      },
    });
    return this.toDomain(data);
  }

  async findById(id: string): Promise<Customer | null> {
    const data = await this.prisma.customer.findUnique({ where: { id } });
    return data ? this.toDomain(data) : null;
  }

  async findByDocument(document: string): Promise<Customer | null> {
    const data = await this.prisma.customer.findUnique({ where: { document } });
    return data ? this.toDomain(data) : null;
  }

  async findAll(params: {
    skip?: number;
    take?: number;
  }): Promise<{ data: Customer[]; total: number }> {
    const [records, total] = await Promise.all([
      this.prisma.customer.findMany({
        skip: params.skip ?? 0,
        take: params.take ?? 20,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customer.count(),
    ]);
    return { data: records.map((r: any) => this.toDomain(r)), total };
  }

  async update(customer: Customer): Promise<Customer> {
    const data = await this.prisma.customer.update({
      where: { id: customer.id },
      data: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        updatedAt: customer.updatedAt,
      },
    });
    return this.toDomain(data);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.customer.delete({ where: { id } });
  }

  async existsById(id: string): Promise<boolean> {
    const count = await this.prisma.customer.count({ where: { id } });
    return count > 0;
  }

  async hasServiceOrders(id: string): Promise<boolean> {
    const count = await this.prisma.serviceOrder.count({
      where: { customerId: id },
    });
    return count > 0;
  }

  private toDomain(data: {
    id: string;
    name: string;
    document: string;
    type: string;
    email: string;
    phone: string;
    address: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): Customer {
    return Customer.reconstitute({
      id: data.id,
      name: data.name,
      document: data.document,
      type: data.type as CustomerType,
      email: data.email,
      phone: data.phone,
      address: data.address ?? undefined,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }
}
