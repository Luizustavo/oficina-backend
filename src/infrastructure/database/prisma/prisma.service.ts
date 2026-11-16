import {
  OnModuleDestroy,
  OnModuleInit,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaClient, Prisma } from '@generated/prisma/client';
import { AsyncLocalStorage } from 'node:async_hooks';
import { PrismaPg } from '@prisma/adapter-pg';

/** Tempo máximo de uma transação aberta por `runInTransaction`. */
const TRANSACTION_TIMEOUT_MS = 15_000;

type AfterCommitCallback = () => Promise<void> | void;

interface TransactionContext {
  tx: Prisma.TransactionClient;
  afterCommit: AfterCommitCallback[];
}

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly client: PrismaClient;
  // Transação ativa no fluxo atual (requisição, mensagem consumida, tick do
  // relay). Os getters abaixo leem daqui, então todo repositório participa da
  // transação aberta por `runInTransaction` sem receber nada por parâmetro.
  private readonly transaction = new AsyncLocalStorage<TransactionContext>();

  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });
    this.client = new PrismaClient({ adapter });
  }

  get customer() {
    return this.db.customer;
  }
  get vehicle() {
    return this.db.vehicle;
  }
  get service() {
    return this.db.service;
  }
  get part() {
    return this.db.part;
  }
  get serviceOrder() {
    return this.db.serviceOrder;
  }
  get serviceOrderService() {
    return this.db.serviceOrderService;
  }
  get serviceOrderPart() {
    return this.db.serviceOrderPart;
  }
  get user() {
    return this.db.user;
  }
  get refreshToken() {
    return this.db.refreshToken;
  }
  get outboxMessage() {
    return this.db.outboxMessage;
  }
  get processedMessage() {
    return this.db.processedMessage;
  }
  get sagaInstance() {
    return this.db.sagaInstance;
  }
  get sagaStepLog() {
    return this.db.sagaStepLog;
  }

  /** Cliente da transação ativa, ou o cliente normal fora de uma. */
  private get db(): PrismaClient | Prisma.TransactionClient {
    return this.transaction.getStore()?.tx ?? this.client;
  }

  /**
   * Executa `fn` numa transação do banco. Tudo o que os repositórios fizerem
   * dentro dela (inclusive gravar no outbox) é confirmado junto ou desfeito
   * junto. Chamada dentro de outra transação, participa da mesma: é isso que
   * deixa o consumidor gravar o efeito da mensagem e o registro de "já
   * processada" de uma vez só, mesmo que o efeito use outros repositórios.
   */
  async runInTransaction<T>(fn: () => Promise<T>): Promise<T> {
    if (this.transaction.getStore()) {
      return fn();
    }
    const afterCommit: AfterCommitCallback[] = [];
    const result = await this.client.$transaction(
      (tx) => this.transaction.run({ tx, afterCommit }, fn),
      { timeout: TRANSACTION_TIMEOUT_MS },
    );
    // Só depois do commit. Uma falha aqui (e-mail fora do ar, por exemplo)
    // não desfaz nada: a transação já foi confirmada.
    for (const callback of afterCommit) {
      try {
        await callback();
      } catch (error) {
        this.logger.warn(
          `After-commit callback failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return result;
  }

  /**
   * Agenda `fn` para depois do commit da transação atual. Fora de uma
   * transação, roda na hora. Para efeitos fora do banco (e-mail, métricas):
   * se a transação for desfeita, eles não acontecem.
   */
  afterCommit(fn: AfterCommitCallback): void {
    const context = this.transaction.getStore();
    if (context) {
      context.afterCommit.push(fn);
      return;
    }
    void Promise.resolve()
      .then(fn)
      .catch((error: unknown) =>
        this.logger.warn(
          `After-commit callback failed: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
  }

  $queryRawUnsafe<T = unknown>(
    query: string,
    ...values: unknown[]
  ): Promise<T> {
    return this.db.$queryRawUnsafe<T>(query, ...values);
  }

  $executeRawUnsafe(
    query: string,
    ...values: unknown[]
  ): ReturnType<PrismaClient['$executeRawUnsafe']> {
    return this.db.$executeRawUnsafe(query, ...values);
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
      'outbox_messages',
      'processed_messages',
      'saga_step_logs',
      'saga_instances',
      // Filhas antes das pais; o CASCADE do TRUNCATE já cobriria, mas ser
      // explícito evita surpresa se o cascade mudar.
      'service_order_services',
      'service_order_parts',
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
