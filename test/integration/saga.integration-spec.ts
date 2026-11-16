/**
 * Saga orquestrada do OS Service (ADR-011) contra Postgres e RabbitMQ de
 * verdade. Os eventos do Billing e do Execution são simulados entregando-os
 * ao mesmo consumidor que roda em produção (SagaEventsConsumer), com os
 * mesmos handlers (SagaEventHandlers): idempotência, transação única por
 * evento, estoque e outbox são os de verdade.
 */
import { ServiceOrderRepository } from '@infrastructure/database/prisma/repositories/service-order.repository';
import { RequestApprovalUseCase } from '@application/use-cases/service-order/request-approval.use-case';
import { ProcessSagaEventUseCase } from '@application/use-cases/saga/process-saga-event.use-case';
import { PrismaTransactionManager } from '@infrastructure/database/prisma/prisma-transaction-manager';
import { RabbitMqMessagePublisher } from '@infrastructure/messaging/rabbitmq-message-publisher';
import { SagaMessageHandlerRegistry } from '@infrastructure/messaging/saga-message-handler.registry';
import { SagaRepository } from '@infrastructure/database/prisma/repositories/saga.repository';
import { PartRepository } from '@infrastructure/database/prisma/repositories/part.repository';
import { IEmailNotificationService } from '@domain/services/email-notification.service.interface';
import { RabbitMqConnection } from '@infrastructure/messaging/rabbitmq-connection.service';
import { ServiceOrderMetrics } from '@infrastructure/observability/service-order.metrics';
import { ServiceOrderEntity } from '@domain/entities/service-order/service-order.entity';
import { SagaEventsConsumer } from '@infrastructure/messaging/saga-events.consumer';
import { SagaEventHandlers } from '@infrastructure/messaging/saga-event-handlers';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { SagaEnvelope } from '@domain/messaging/saga-message';
import { randomUUID } from 'crypto';
import { Logger } from '@nestjs/common';

import type { ConsumeMessage } from 'amqplib';

const CUSTOMER_ID = randomUUID();
const VEHICLE_ID = randomUUID();
const PART_ID = randomUUID();
const SERVICE_ID = randomUUID();

describe('Saga orquestrada (integração)', () => {
  let prisma: PrismaService;
  let connection: RabbitMqConnection;
  let publisher: RabbitMqMessagePublisher;
  let consumer: SagaEventsConsumer;
  let orders: ServiceOrderRepository;
  let requestApproval: RequestApprovalUseCase;
  const emails: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.onModuleInit();
    orders = new ServiceOrderRepository(prisma);
    const sagas = new SagaRepository(prisma);
    const parts = new PartRepository(prisma);
    const transactions = new PrismaTransactionManager(prisma);
    const emailService: IEmailNotificationService = {
      sendServiceOrderStatusUpdate: ({ status }) => {
        emails.push(status);
        return Promise.resolve();
      },
    };
    const metrics = {
      recordTransition: jest.fn(),
    } as unknown as ServiceOrderMetrics;
    const logger = new Logger('saga-test');

    const processSagaEvent = new ProcessSagaEventUseCase(
      orders,
      sagas,
      parts,
      transactions,
      emailService,
      // Prazos longos: os testes de prazo vencido ficam para a varredura.
      { approvalTimeoutMs: 3_600_000, paymentTimeoutMs: 3_600_000 },
      metrics,
      logger,
    );
    requestApproval = new RequestApprovalUseCase(
      orders,
      sagas,
      transactions,
      emailService,
      metrics,
      logger,
    );

    connection = new RabbitMqConnection();
    publisher = new RabbitMqMessagePublisher(connection);
    publisher.onModuleInit();
    await publisher.whenReady();
    const registry = new SagaMessageHandlerRegistry();
    new SagaEventHandlers(registry, processSagaEvent).onModuleInit();
    consumer = new SagaEventsConsumer(connection, publisher, registry, prisma);

    await prisma.customer.create({
      data: {
        id: CUSTOMER_ID,
        name: 'Maria Souza',
        document: `doc-${CUSTOMER_ID.slice(0, 8)}`,
        type: 'INDIVIDUAL',
        email: 'maria@exemplo.com',
        phone: '11999999999',
      },
    });
    await prisma.vehicle.create({
      data: {
        id: VEHICLE_ID,
        customerId: CUSTOMER_ID,
        licensePlate: `SG${CUSTOMER_ID.slice(0, 5).toUpperCase()}`,
        brand: 'Fiat',
        model: 'Uno',
        year: 2015,
      },
    });
    await prisma.service.create({
      data: {
        id: SERVICE_ID,
        name: `Revisão ${SERVICE_ID.slice(0, 6)}`,
        price: 100,
        estimatedDurationMinutes: 60,
      },
    });
  });

  beforeEach(async () => {
    emails.length = 0;
    await prisma.part.upsert({
      where: { id: PART_ID },
      create: {
        id: PART_ID,
        name: 'Pastilha de freio',
        code: `PF-${PART_ID.slice(0, 6)}`,
        price: 50,
        stockQuantity: 5,
        minStockQuantity: 0,
      },
      update: { stockQuantity: 5 },
    });
  });

  afterAll(async () => {
    await publisher.onModuleDestroy();
    await connection.onModuleDestroy();
    const orderIds = (
      await prisma.serviceOrder.findMany({ where: { customerId: CUSTOMER_ID } })
    ).map((o) => o.id);
    await prisma.sagaInstance.deleteMany({
      where: { orderId: { in: orderIds } },
    });
    await prisma.outboxMessage.deleteMany({});
    await prisma.processedMessage.deleteMany({});
    await prisma.serviceOrder.deleteMany({
      where: { customerId: CUSTOMER_ID },
    });
    await prisma.part.deleteMany({ where: { id: PART_ID } });
    await prisma.service.deleteMany({ where: { id: SERVICE_ID } });
    await prisma.vehicle.deleteMany({ where: { customerId: CUSTOMER_ID } });
    await prisma.customer.deleteMany({ where: { id: CUSTOMER_ID } });
    await prisma.onModuleDestroy();
  });

  /** OS em diagnóstico com 1 serviço e 2 pastilhas, pronta para pedir aprovação. */
  const orderInDiagnosis = async (): Promise<ServiceOrderEntity> => {
    const order = ServiceOrderEntity.create(
      {
        orderNumber: `OS-${randomUUID().slice(0, 8)}`,
        customerId: CUSTOMER_ID,
        vehicleId: VEHICLE_ID,
        customerName: 'Maria Souza',
        customerEmail: 'maria@exemplo.com',
        vehiclePlate: 'ABC1D23',
        problemDescription: 'Freio rangendo',
      },
      randomUUID(),
    );
    order.addService({
      serviceId: SERVICE_ID,
      serviceName: 'Revisão',
      price: 100,
      quantity: 1,
    });
    order.addPart({
      partId: PART_ID,
      partName: 'Pastilha de freio',
      partCode: 'PF',
      unitPrice: 50,
      quantity: 2,
      totalPrice: 100,
    });
    order.startDiagnosis();
    return orders.create(order);
  };

  const sagaOf = (orderId: string) =>
    prisma.sagaInstance.findFirstOrThrow({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });

  /** Evento como o Billing ou o Execution publicariam. */
  const event = async (
    orderId: string,
    type: string,
    payload: Record<string, unknown> = {},
    messageId = randomUUID(),
  ): Promise<ConsumeMessage> => {
    const saga = await sagaOf(orderId);
    const envelope: SagaEnvelope = {
      messageId,
      sagaId: saga.id,
      orderId,
      type,
      version: 1,
      occurredAt: new Date().toISOString(),
      payload,
    };
    return {
      content: Buffer.from(JSON.stringify(envelope)),
      fields: {} as ConsumeMessage['fields'],
      properties: {
        messageId,
        headers: {},
      } as unknown as ConsumeMessage['properties'],
    };
  };

  const stock = async () =>
    (await prisma.part.findUniqueOrThrow({ where: { id: PART_ID } }))
      .stockQuantity;

  const commandsOf = async (orderId: string) =>
    (
      await prisma.outboxMessage.findMany({
        where: { payload: { path: ['orderId'], equals: orderId } },
        orderBy: { createdAt: 'asc' },
      })
    ).map((row) => row.routingKey);

  it('caminho feliz: orçamento → aprovação → pagamento → execução → OS concluída', async () => {
    const { id } = await orderInDiagnosis();

    const awaiting = await requestApproval.execute(id);
    expect(awaiting.status).toBe('AWAITING_APPROVAL');
    expect(await commandsOf(id)).toEqual(['billing.budget.create']);
    const budgetCommand = await prisma.outboxMessage.findFirstOrThrow({
      where: { payload: { path: ['orderId'], equals: id } },
    });
    expect(budgetCommand.payload).toMatchObject({
      payload: {
        customer: { name: 'Maria Souza', email: 'maria@exemplo.com' },
        totalAmount: '200.00',
      },
    });

    const steps: Array<[string, string]> = [
      ['billing.budget.created', 'AWAITING_APPROVAL'],
      ['billing.budget.approved', 'AWAITING_PAYMENT'],
      ['billing.payment.confirmed', 'PAID'],
      ['execution.job.queued', 'PAID'],
      ['execution.job.started', 'IN_PROGRESS'],
      ['execution.job.completed', 'COMPLETED'],
    ];
    for (const [type, orderStatus] of steps) {
      expect(await consumer.handle(await event(id, type))).toBe('processed');
      expect((await orders.findById(id))?.status).toBe(orderStatus);
      if (type === 'billing.budget.approved') {
        // Peças reservadas na aprovação.
        expect(await stock()).toBe(3);
      }
    }

    const saga = await sagaOf(id);
    expect(saga).toMatchObject({ status: 'COMPLETED', step: 'FINISHED' });
    expect(await commandsOf(id)).toEqual([
      'billing.budget.create',
      'execution.job.enqueue',
    ]);
    const logs = await prisma.sagaStepLog.findMany({
      where: { sagaId: saga.id },
    });
    expect(logs).toHaveLength(7);
    expect(emails).toEqual([
      'AWAITING_APPROVAL',
      'AWAITING_PAYMENT',
      'PAID',
      'IN_PROGRESS',
      'COMPLETED',
    ]);
  });

  it('evento repetido não reserva as peças duas vezes', async () => {
    const { id } = await orderInDiagnosis();
    await requestApproval.execute(id);
    await consumer.handle(await event(id, 'billing.budget.created'));

    const approved = await event(
      id,
      'billing.budget.approved',
      {},
      randomUUID(),
    );
    expect(await consumer.handle(approved)).toBe('processed');
    expect(await consumer.handle(approved)).toBe('duplicate');

    expect(await stock()).toBe(3);
  });

  it('pagamento recusado: devolve as peças, cancela a OS e o orçamento', async () => {
    const { id } = await orderInDiagnosis();
    await requestApproval.execute(id);
    await consumer.handle(await event(id, 'billing.budget.created'));
    await consumer.handle(await event(id, 'billing.budget.approved'));
    expect(await stock()).toBe(3);

    expect(
      await consumer.handle(
        await event(id, 'billing.payment.failed', { reason: 'REJECTED' }),
      ),
    ).toBe('processed');

    expect((await orders.findById(id))?.status).toBe('CANCELED');
    expect(await stock()).toBe(5);
    expect(await commandsOf(id)).toEqual([
      'billing.budget.create',
      'billing.budget.cancel',
    ]);
    expect(await sagaOf(id)).toMatchObject({
      status: 'COMPENSATING',
      step: 'CANCELING_BUDGET',
    });

    await consumer.handle(await event(id, 'billing.budget.canceled'));
    expect(await sagaOf(id)).toMatchObject({ status: 'COMPENSATED' });
  });

  it('falha na execução: estorno pedido, peças devolvidas, OS cancelada', async () => {
    const { id } = await orderInDiagnosis();
    await requestApproval.execute(id);
    for (const type of [
      'billing.budget.created',
      'billing.budget.approved',
      'billing.payment.confirmed',
      'execution.job.started',
    ]) {
      await consumer.handle(await event(id, type));
    }

    await consumer.handle(
      await event(id, 'execution.job.failed', {
        reason: 'TECHNICAL_ISSUE',
        detail: 'motor travado',
      }),
    );

    expect((await orders.findById(id))?.status).toBe('CANCELED');
    expect(await stock()).toBe(5);
    expect(await commandsOf(id)).toContain('billing.payment.refund');
    expect(await sagaOf(id)).toMatchObject({
      status: 'COMPENSATING',
      step: 'REFUNDING',
      lastError: 'TECHNICAL_ISSUE: motor travado',
    });

    await consumer.handle(await event(id, 'billing.payment.refunded'));
    expect(await sagaOf(id)).toMatchObject({ status: 'COMPENSATED' });
  });

  it('orçamento não gerado: OS volta ao diagnóstico e uma nova tentativa abre outra saga', async () => {
    const { id } = await orderInDiagnosis();
    await requestApproval.execute(id);
    const first = await sagaOf(id);

    await consumer.handle(
      await event(id, 'billing.budget.creation-failed', {
        reason: 'INVALID_ITEMS',
      }),
    );
    expect((await orders.findById(id))?.status).toBe('IN_DIAGNOSIS');
    expect(await sagaOf(id)).toMatchObject({ status: 'COMPENSATED' });

    await requestApproval.execute(id);
    const second = await sagaOf(id);
    expect(second.id).not.toBe(first.id);
    expect(second.status).toBe('RUNNING');
  });

  it('evento à frente do passo atual volta para a retentativa sem efeito', async () => {
    const { id } = await orderInDiagnosis();
    await requestApproval.execute(id);

    expect(
      await consumer.handle(await event(id, 'billing.payment.confirmed')),
    ).toBe('retried');
    expect((await orders.findById(id))?.status).toBe('AWAITING_APPROVAL');
  });
});
