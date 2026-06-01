import {
  OnModuleDestroy,
  OnModuleInit,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly client: PrismaClient;

  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });
    this.client = new PrismaClient({ adapter });
  }

  get customer() {
    return this.client.customer;
  }
  get vehicle() {
    return this.client.vehicle;
  }
  get service() {
    return this.client.service;
  }
  get part() {
    return this.client.part;
  }
  get serviceOrder() {
    return this.client.serviceOrder;
  }
  get user() {
    return this.client.user;
  }
  get refreshToken() {
    return this.client.refreshToken;
  }

  $executeRawUnsafe(
    query: string,
    ...values: unknown[]
  ): ReturnType<PrismaClient['$executeRawUnsafe']> {
    return this.client.$executeRawUnsafe(query, ...values);
  }

  async onModuleInit(): Promise<void> {
    await this.client.$connect();
    this.logger.log('Database connected successfully');
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
    this.logger.log('Database disconnected');
  }

  async cleanDatabase(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('cleanDatabase is not allowed in production');
    }
    const tableNames = [
      'refresh_tokens',
      'service_orders',
      'vehicles',
      'customers',
      'services',
      'parts',
      'users',
    ];
    for (const tableName of tableNames) {
      await this.client.$executeRawUnsafe(
        `TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE;`,
      );
    }
  }
}
