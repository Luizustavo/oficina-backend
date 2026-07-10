import { PrismaCustomerMapper } from '@infrastructure/database/prisma/mappers/prisma-customer.mapper';
import { ICustomerRepository } from '@domain/repositories/customer.repository.interface';
import { CustomerEntity } from '@domain/entities/customer/customer.entity';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class CustomerRepository implements ICustomerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(customer: CustomerEntity): Promise<CustomerEntity> {
    const data = PrismaCustomerMapper.toPrisma(customer);
    const created = await this.prisma.customer.create({ data });
    return PrismaCustomerMapper.toEntity(created);
  }

  async findById(id: string): Promise<CustomerEntity | null> {
    const data = await this.prisma.customer.findUnique({ where: { id } });
    return data ? PrismaCustomerMapper.toEntity(data) : null;
  }

  async findByDocument(document: string): Promise<CustomerEntity | null> {
    const data = await this.prisma.customer.findUnique({ where: { document } });
    return data ? PrismaCustomerMapper.toEntity(data) : null;
  }

  async findAll(params: {
    skip?: number;
    take?: number;
  }): Promise<{ data: CustomerEntity[]; total: number }> {
    const [records, total] = await Promise.all([
      this.prisma.customer.findMany({
        skip: params.skip ?? 0,
        take: params.take ?? 20,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customer.count(),
    ]);
    return {
      data: records.map((item) => PrismaCustomerMapper.toEntity(item)),
      total,
    };
  }

  async update(customer: CustomerEntity): Promise<CustomerEntity> {
    const data = PrismaCustomerMapper.toPrisma(customer);
    const updated = await this.prisma.customer.update({
      where: { id: customer.id },
      data,
    });
    return PrismaCustomerMapper.toEntity(updated);
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
}
