import { ITransactionManager } from '@domain/services/transaction-manager.interface';
import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** ITransactionManager sobre o PrismaService (ver `runInTransaction`). */
@Injectable()
export class PrismaTransactionManager implements ITransactionManager {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(fn: () => Promise<T>): Promise<T> {
    return this.prisma.runInTransaction(fn);
  }

  afterCommit(fn: () => Promise<void> | void): void {
    this.prisma.afterCommit(fn);
  }
}
