import { Prisma, Customer as PrismaCustomer } from '@generated/prisma/client';
import { CustomerEntity } from '@domain/entities/customer/customer.entity';
import { CustomerType } from '@domain/enums/customer-type.enum';

export class PrismaCustomerMapper {
  private constructor() {
    throw new Error(
      'PrismaCustomerMapper is a static class and cannot be instantiated.',
    );
  }

  public static toPrisma(entity: CustomerEntity): Prisma.CustomerCreateInput {
    return {
      id: entity.id,
      name: entity.name,
      document: entity.document,
      type: entity.type,
      email: entity.email,
      phone: entity.phone,
      address: entity.address,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  public static toEntity(prisma: PrismaCustomer): CustomerEntity {
    return CustomerEntity.reconstitute(
      {
        name: prisma.name,
        document: prisma.document,
        type: prisma.type as CustomerType,
        email: prisma.email,
        phone: prisma.phone,
        address: prisma.address || undefined,
        createdAt: prisma.createdAt,
        updatedAt: prisma.updatedAt,
      },
      prisma.id,
    );
  }
}
