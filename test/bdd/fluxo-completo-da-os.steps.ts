import { SagaEventsConsumer } from '@infrastructure/messaging/saga-events.consumer';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { autoBindSteps, loadFeature, StepDefinitions } from 'jest-cucumber';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { join } from 'node:path';

import type { ConsumeMessage } from 'amqplib';
import type { App } from 'supertest/types';

const ADMIN = { email: 'admin.bdd@oficina.com', password: 'Admin123!' };

let app: INestApplication<App>;
let prisma: PrismaService;
let consumer: SagaEventsConsumer;
let token: string;
let partId: string;
let customerId: string;
let vehicleId: string;
let serviceId: string;
let orderId: string;

const http = () => request(app.getHttpServer());
const auth = { Authorization: '' };

async function api(
  method: 'get' | 'post' | 'patch',
  path: string,
  body?: object,
) {
  const res = await http()[method](path).set(auth).send(body);
  if (res.status >= 400) {
    throw new Error(
      `${method.toUpperCase()} ${path} → ${res.status}: ${JSON.stringify(res.body)}`,
    );
  }
  return res.body as Record<string, unknown>;
}

async function deliverEvent(
  type: string,
  payload: Record<string, unknown> = {},
) {
  const saga = await api('get', `/api/service-orders/${orderId}/saga`);
  const envelope = {
    messageId: randomUUID(),
    sagaId: saga.sagaId as string,
    orderId,
    type,
    version: 1,
    occurredAt: new Date().toISOString(),
    payload,
  };
  const outcome = await consumer.handle({
    content: Buffer.from(JSON.stringify(envelope)),
    fields: {},
    properties: { messageId: envelope.messageId, headers: {} },
  } as unknown as ConsumeMessage);
  expect(outcome).toBe('processed');
}

async function openOrderInDiagnosis(parts: number) {
  const order = await api('post', '/api/service-orders', {
    customerId,
    vehicleId,
    problemDescription: 'Barulho no motor',
  });
  orderId = order.id as string;
  await api('patch', `/api/service-orders/${orderId}/services`, {
    serviceId,
    quantity: 1,
  });
  await api('patch', `/api/service-orders/${orderId}/parts`, {
    partId,
    quantity: parts,
  });
  await api('patch', `/api/service-orders/${orderId}/start-diagnosis`);
}

const steps: StepDefinitions = ({ given, when, then }) => {
  given(
    /^um cliente com um veículo e a peça "(.*)" com (\d+) unidades em estoque$/,
    async (partName: string, stock: string) => {
      const customer = await prisma.customer.create({
        data: {
          name: 'Carlos Silva',
          document: '52998224725',
          type: 'INDIVIDUAL',
          email: 'carlos@email.com',
          phone: '11999990001',
        },
      });
      customerId = customer.id;
      const vehicle = await prisma.vehicle.create({
        data: {
          customerId,
          licensePlate: 'ABC1D23',
          brand: 'Toyota',
          model: 'Corolla',
          year: 2020,
        },
      });
      vehicleId = vehicle.id;
      const service = await prisma.service.create({
        data: {
          name: 'Troca de óleo',
          price: 120,
          estimatedDurationMinutes: 60,
          isActive: true,
        },
      });
      serviceId = service.id;
      const part = await prisma.part.create({
        data: {
          name: partName,
          code: 'FO001',
          price: 35,
          stockQuantity: Number(stock),
          minStockQuantity: 1,
          isActive: true,
        },
      });
      partId = part.id;
    },
  );

  given(
    /^uma OS aberta com um serviço e (\d+) peças, já em diagnóstico$/,
    (parts: string) => openOrderInDiagnosis(Number(parts)),
  );

  given(/^a OS já paga e com o job em execução$/, async () => {
    await api('patch', `/api/service-orders/${orderId}/request-approval`);
    for (const type of [
      'billing.budget.created',
      'billing.budget.approved',
      'billing.payment.confirmed',
      'execution.job.queued',
      'execution.job.started',
    ]) {
      await deliverEvent(type);
    }
    const order = await api('get', `/api/service-orders/${orderId}`);
    expect(order.status).toBe('IN_PROGRESS');
  });

  when(/^a equipe pede a aprovação do orçamento$/, () =>
    api('patch', `/api/service-orders/${orderId}/request-approval`),
  );

  when(/^o (?:Billing|Execution) informa "([^"]*)"$/, (type: string) =>
    deliverEvent(type),
  );

  when(
    /^o Execution informa "([^"]*)" com o motivo "([^"]*)"$/,
    (type: string, reason: string) =>
      deliverEvent(type, { reason, detail: 'peça em falta no fornecedor' }),
  );

  when(/^a equipe entrega o veículo$/, () =>
    api('patch', `/api/service-orders/${orderId}/deliver`),
  );

  then(/^a OS fica "([^"]*)"$/, async (status: string) => {
    const order = await api('get', `/api/service-orders/${orderId}`);
    expect(order.status).toBe(status);
  });

  then(/^o comando "([^"]*)" é enviado$/, async (routingKey: string) => {
    const sent = await prisma.outboxMessage.findMany({ where: { routingKey } });
    expect(
      sent.filter(
        (message) =>
          (message.payload as { orderId?: string }).orderId === orderId,
      ),
    ).toHaveLength(1);
  });

  then(/^o estoque da peça fica em (\d+)$/, async (stock: string) => {
    const part = await api('get', `/api/parts/${partId}`);
    expect(part.stockQuantity).toBe(Number(stock));
  });

  then(/^a saga termina "([^"]*)"$/, async (status: string) => {
    const saga = await api('get', `/api/service-orders/${orderId}/saga`);
    expect(saga.status).toBe(status);
  });
};

beforeAll(async () => {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = moduleFixture.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  prisma = app.get(PrismaService);
  consumer = app.get(SagaEventsConsumer);
});

beforeEach(async () => {
  await prisma.cleanDatabase();
  await prisma.user.create({
    data: {
      name: 'Admin BDD',
      email: ADMIN.email,
      password: await bcrypt.hash(ADMIN.password, 4),
      role: 'ADMIN',
      isActive: true,
    },
  });
  const login = await http().post('/api/auth/login').send(ADMIN).expect(201);
  token = (login.body as { accessToken: string }).accessToken;
  auth.Authorization = `Bearer ${token}`;
});

afterAll(async () => {
  await prisma.cleanDatabase();
  await app.close();
});

autoBindSteps(
  loadFeature(join(__dirname, 'features/fluxo-completo-da-os.feature')),
  [steps],
);
