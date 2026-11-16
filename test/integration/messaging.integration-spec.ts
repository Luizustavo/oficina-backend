/**
 * Mensageria do OS Service contra um Postgres e um RabbitMQ de verdade
 * (etapa 4.9 do PLANO-FASE-4): outbox na mesma transação, relay com
 * publisher confirms, consumidor idempotente, retentativa e DLQ.
 *
 * Precisa de DATABASE_URL e RABBITMQ_URL (no CI, os dois sobem como
 * `services:` do job de integração).
 */
import {
  RabbitMqMessagePublisher,
  UnroutableMessageError,
} from '@infrastructure/messaging/rabbitmq-message-publisher';
import { ServiceOrderRepository } from '@infrastructure/database/prisma/repositories/service-order.repository';
import { SagaMessageHandlerRegistry } from '@infrastructure/messaging/saga-message-handler.registry';
import { RabbitMqConnection } from '@infrastructure/messaging/rabbitmq-connection.service';
import { buildSagaCommand, SagaEnvelope } from '@domain/messaging/saga-message';
import { OutboxRelayService } from '@infrastructure/messaging/outbox-relay.service';
import { SagaEventsConsumer } from '@infrastructure/messaging/saga-events.consumer';
import { ServiceOrderEntity } from '@domain/entities/service-order/service-order.entity';
import { InvalidMessageException } from '@shared/exceptions/domain.exceptions';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { OS_SAGA_EVENTS_QUEUE } from '@infrastructure/messaging/topology';
import { randomUUID } from 'crypto';
import { connect } from 'amqplib';

import type {
  Channel,
  ChannelModel,
  ConsumeMessage,
  GetMessage,
} from 'amqplib';

const CUSTOMER_ID = randomUUID();
const VEHICLE_ID = randomUUID();
const CAPTURE_QUEUE = `test.capture.${randomUUID()}`;

describe('Mensageria do OS Service (integração)', () => {
  let prisma: PrismaService;
  let repository: ServiceOrderRepository;
  let connection: RabbitMqConnection;
  let publisher: RabbitMqMessagePublisher;
  let relay: OutboxRelayService;
  let registry: SagaMessageHandlerRegistry;
  let consumer: SagaEventsConsumer;
  let amqp: ChannelModel;
  let probe: Channel;

  /** Chamadas recebidas pelo tratador de teste, por messageId. */
  const handled: string[] = [];
  /** Quando definido, o tratador de teste lança este erro depois de gravar. */
  let failWith: Error | undefined;

  beforeAll(async () => {
    if (!process.env.RABBITMQ_URL) {
      throw new Error('RABBITMQ_URL is required for this suite');
    }
    prisma = new PrismaService();
    await prisma.onModuleInit();
    repository = new ServiceOrderRepository(prisma);

    connection = new RabbitMqConnection();
    publisher = new RabbitMqMessagePublisher(connection);
    publisher.onModuleInit();
    await publisher.whenReady();
    relay = new OutboxRelayService(prisma, publisher);

    registry = new SagaMessageHandlerRegistry();
    registry.register({
      type: 'billing.test.happened',
      versions: [1],
      handle: async (envelope: SagaEnvelope) => {
        // Efeito no banco, dentro da transação do consumidor.
        await prisma.serviceOrder.update({
          where: { id: envelope.orderId },
          data: { notes: `handled ${envelope.messageId}` },
        });
        if (failWith) throw failWith;
        handled.push(envelope.messageId);
      },
    });
    consumer = new SagaEventsConsumer(connection, publisher, registry, prisma);

    // Canal "de fora", para observar as filas como um terceiro faria.
    amqp = await connect(process.env.RABBITMQ_URL);
    probe = await amqp.createChannel();
    await probe.assertQueue(CAPTURE_QUEUE, { exclusive: true });
    await probe.bindQueue(CAPTURE_QUEUE, 'saga.commands', 'billing.#');

    await prisma.customer.create({
      data: {
        id: CUSTOMER_ID,
        name: 'Jane Doe',
        document: `doc-${CUSTOMER_ID.slice(0, 8)}`,
        type: 'INDIVIDUAL',
        email: 'jane@example.com',
        phone: '11999999999',
      },
    });
    await prisma.vehicle.create({
      data: {
        id: VEHICLE_ID,
        customerId: CUSTOMER_ID,
        licensePlate: `MQ${CUSTOMER_ID.slice(0, 5).toUpperCase()}`,
        brand: 'VW',
        model: 'Gol',
        year: 2020,
      },
    });
  });

  beforeEach(async () => {
    handled.length = 0;
    failWith = undefined;
    await prisma.outboxMessage.deleteMany({});
    await prisma.processedMessage.deleteMany({});
    for (const queue of [
      OS_SAGA_EVENTS_QUEUE,
      `${OS_SAGA_EVENTS_QUEUE}.retry.1`,
      `${OS_SAGA_EVENTS_QUEUE}.dlq`,
      CAPTURE_QUEUE,
    ]) {
      await probe.purgeQueue(queue);
    }
  });

  afterAll(async () => {
    await consumer.onModuleDestroy();
    await publisher.onModuleDestroy();
    await connection.onModuleDestroy();
    await amqp.close();
    await prisma.outboxMessage.deleteMany({});
    await prisma.processedMessage.deleteMany({});
    await prisma.serviceOrder.deleteMany({
      where: { customerId: CUSTOMER_ID },
    });
    await prisma.vehicle.deleteMany({ where: { customerId: CUSTOMER_ID } });
    await prisma.customer.deleteMany({ where: { id: CUSTOMER_ID } });
    await prisma.onModuleDestroy();
  });

  const createOrder = async (): Promise<ServiceOrderEntity> =>
    repository.create(
      ServiceOrderEntity.create(
        {
          orderNumber: `OS-${randomUUID().slice(0, 8)}`,
          customerId: CUSTOMER_ID,
          vehicleId: VEHICLE_ID,
          customerName: 'Jane Doe',
          customerEmail: 'jane@example.com',
          vehiclePlate: 'ABC1D23',
          problemDescription: 'Barulho no motor',
        },
        randomUUID(),
      ),
    );

  const command = (orderId: string, type = 'billing.budget.create') =>
    buildSagaCommand({
      messageId: randomUUID(),
      sagaId: randomUUID(),
      orderId,
      type,
      occurredAt: new Date(),
      payload: { totalAmount: '350.00' },
    });

  /** Mensagem como o RabbitMQ entregaria ao consumidor. */
  const delivery = (envelope: unknown, retryCount?: number): ConsumeMessage => {
    const body =
      typeof envelope === 'string' ? envelope : JSON.stringify(envelope);
    const messageId =
      typeof envelope === 'object' && envelope !== null
        ? (envelope as SagaEnvelope).messageId
        : randomUUID();
    return {
      content: Buffer.from(body),
      fields: {} as ConsumeMessage['fields'],
      properties: {
        messageId,
        contentType: 'application/json',
        headers:
          retryCount === undefined ? {} : { 'x-retry-count': retryCount },
      } as unknown as ConsumeMessage['properties'],
    };
  };

  const event = (orderId: string, messageId = randomUUID()): SagaEnvelope => ({
    messageId,
    sagaId: randomUUID(),
    orderId,
    type: 'billing.test.happened',
    version: 1,
    occurredAt: new Date().toISOString(),
    payload: {},
  });

  /** Espera uma mensagem aparecer na fila (o broker é assíncrono). */
  const waitForMessage = async (queue: string): Promise<GetMessage> => {
    for (let i = 0; i < 50; i++) {
      const msg = await probe.get(queue, { noAck: true });
      if (msg) return msg;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(`No message arrived in ${queue}`);
  };

  describe('outbox', () => {
    it('grava a mudança de status e a mensagem na mesma transação', async () => {
      const order = await createOrder();
      order.startDiagnosis();
      const message = command(order.id);

      await repository.update(order, [message]);

      const row = await prisma.outboxMessage.findUnique({
        where: { id: message.envelope.messageId },
      });
      expect(row).toMatchObject({
        exchange: 'saga.commands',
        routingKey: 'billing.budget.create',
        publishedAt: null,
      });
      expect(row?.payload).toEqual(message.envelope);
    });

    it('desfaz a mudança de status e a mensagem juntas quando a transação falha', async () => {
      const order = await createOrder();
      order.startDiagnosis();
      const message = command(order.id);

      await expect(
        prisma.runInTransaction(async () => {
          await repository.update(order, [message]);
          throw new Error('falha depois de gravar');
        }),
      ).rejects.toThrow('falha depois de gravar');

      expect((await repository.findById(order.id))?.status).toBe('RECEIVED');
      expect(
        await prisma.outboxMessage.count({
          where: { id: message.envelope.messageId },
        }),
      ).toBe(0);
    });
  });

  describe('relay', () => {
    it('publica as pendentes com as propriedades do contrato e marca publishedAt', async () => {
      const order = await createOrder();
      const message = command(order.id);
      await repository.update(order, [message]);

      expect(await relay.publishPending()).toBe(1);

      const received = await waitForMessage(CAPTURE_QUEUE);
      expect(JSON.parse(received.content.toString())).toEqual(message.envelope);
      expect(received.properties).toMatchObject({
        messageId: message.envelope.messageId,
        correlationId: message.envelope.sagaId,
        type: 'billing.budget.create',
        contentType: 'application/json',
        deliveryMode: 2,
      });
      const row = await prisma.outboxMessage.findUnique({
        where: { id: message.envelope.messageId },
      });
      expect(row?.publishedAt).toBeInstanceOf(Date);
      expect(await relay.publishPending()).toBe(0);
    });

    it('mantém pendente a mensagem que nenhuma fila recebe, e as que vêm depois dela', async () => {
      const order = await createOrder();
      const orphan = command(order.id, 'nobody.listens.here');
      const next = command(order.id);
      await repository.update(order, [orphan]);
      await repository.update(order, [next]);

      expect(await relay.publishPending()).toBe(0);

      const rows = await prisma.outboxMessage.findMany({
        where: { publishedAt: null },
      });
      expect(rows.map((r) => r.id).sort()).toEqual(
        [orphan.envelope.messageId, next.envelope.messageId].sort(),
      );
    });

    it('recusa a publicação sem destino com UnroutableMessageError', async () => {
      await expect(
        publisher.publish(command(randomUUID(), 'nobody.listens.here')),
      ).rejects.toBeInstanceOf(UnroutableMessageError);
    });
  });

  describe('consumidor', () => {
    it('aplica o efeito uma vez só quando a mesma mensagem chega duas vezes', async () => {
      const order = await createOrder();
      const envelope = event(order.id);

      expect(await consumer.handle(delivery(envelope))).toBe('processed');
      expect(await consumer.handle(delivery(envelope))).toBe('duplicate');

      expect(handled).toEqual([envelope.messageId]);
      expect(
        await prisma.processedMessage.count({
          where: { messageId: envelope.messageId },
        }),
      ).toBe(1);
    });

    it('desfaz o efeito e manda para a fila de espera quando o tratador falha', async () => {
      const order = await createOrder();
      const envelope = event(order.id);
      failWith = new Error('banco ocupado');

      expect(await consumer.handle(delivery(envelope))).toBe('retried');

      // Nada ficou gravado: nem o efeito, nem o "já processada".
      expect((await repository.findById(order.id))?.notes).toBeUndefined();
      expect(
        await prisma.processedMessage.count({
          where: { messageId: envelope.messageId },
        }),
      ).toBe(0);

      const retried = await waitForMessage(`${OS_SAGA_EVENTS_QUEUE}.retry.1`);
      expect(retried.properties.messageId).toBe(envelope.messageId);
      expect(retried.properties.headers?.['x-retry-count']).toBe(1);
      expect(JSON.parse(retried.content.toString())).toEqual(envelope);
    });

    it('manda para a DLQ depois da terceira retentativa', async () => {
      const order = await createOrder();
      const envelope = event(order.id);
      failWith = new Error('ainda falhando');

      expect(await consumer.handle(delivery(envelope, 3))).toBe(
        'dead-lettered',
      );

      const dead = await waitForMessage(`${OS_SAGA_EVENTS_QUEUE}.dlq`);
      expect(dead.properties.messageId).toBe(envelope.messageId);
    });

    it.each([
      ['JSON quebrado', '{"messageId":'],
      [
        'tipo sem tratador',
        { ...event(randomUUID()), type: 'billing.unknown' },
      ],
      ['versão não suportada', { ...event(randomUUID()), version: 9 }],
    ])('rejeita sem retentativa: %s', async (_label, body) => {
      expect(await consumer.handle(delivery(body))).toBe('rejected');
      expect(handled).toHaveLength(0);
    });

    it('rejeita quando o tratador diz que a mensagem é inválida', async () => {
      const order = await createOrder();
      failWith = new InvalidMessageException('payload sem budgetId');
      expect(await consumer.handle(delivery(event(order.id)))).toBe('rejected');
    });

    it('consome da fila de verdade: processa a válida e manda a inválida para a DLQ', async () => {
      consumer.onApplicationBootstrap();
      await consumer.whenReady();
      const order = await createOrder();
      const envelope = event(order.id);

      probe.publish(
        'saga.events',
        'billing.test.happened',
        Buffer.from(JSON.stringify(envelope)),
        {
          messageId: envelope.messageId,
          persistent: true,
        },
      );
      probe.publish(
        'saga.events',
        'billing.test.happened',
        Buffer.from('não é JSON'),
        {
          messageId: randomUUID(),
          persistent: true,
        },
      );

      const dead = await waitForMessage(`${OS_SAGA_EVENTS_QUEUE}.dlq`);
      expect(dead.content.toString()).toBe('não é JSON');
      for (let i = 0; i < 50 && handled.length === 0; i++) {
        await new Promise((r) => setTimeout(r, 100));
      }
      expect(handled).toEqual([envelope.messageId]);
      expect((await repository.findById(order.id))?.notes).toBe(
        `handled ${envelope.messageId}`,
      );
    });
  });
});
