import {
  InvalidMessageException,
  SagaEventOutOfOrderException,
} from '@shared/exceptions/domain.exceptions';
import { IEmailNotificationService } from '@domain/services/email-notification.service.interface';
import { IServiceOrderRepository } from '@domain/repositories/service-order.repository.interface';
import { ServiceOrderStatus } from '@domain/validators/value-objects/service-order-status.value-object';
import { ITransactionManager } from '@domain/services/transaction-manager.interface';
import { ServiceOrderEntity } from '@domain/entities/service-order/service-order.entity';
import { ServiceOrderMetrics } from '@infrastructure/observability/service-order.metrics';
import { ISagaRepository } from '@domain/repositories/saga.repository.interface';
import { SagaInstanceEntity } from '@domain/entities/saga/saga-instance.entity';
import { IPartRepository } from '@domain/repositories/part.repository.interface';
import { ProcessSagaEventUseCase } from './process-saga-event.use-case';
import { SagaStatus, SagaStep } from '@domain/enums/saga.enum';
import { PartEntity } from '@domain/entities/part/part.entity';
import { Logger } from '@nestjs/common';

const ORDER_ID = 'so-1';
const SAGA_ID = 'saga-1';
const HOUR = 3_600_000;

const makeOrder = (status: ServiceOrderStatus) =>
  ServiceOrderEntity.reconstitute(
    {
      orderNumber: 'OS001',
      customerId: 'c-1',
      vehicleId: 'v-1',
      customerName: 'Jane Doe',
      customerEmail: 'jane@example.com',
      vehiclePlate: 'ABC1D23',
      problemDescription: 'Freio',
      status,
      services: [
        { serviceId: 's-1', serviceName: 'Revisão', price: 100, quantity: 1 },
      ],
      parts: [
        {
          partId: 'p-1',
          partName: 'Pastilha',
          partCode: 'P-1',
          unitPrice: 50,
          quantity: 2,
          totalPrice: 100,
        },
      ],
      totalAmount: 200,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    ORDER_ID,
  );

const makeSaga = (step: SagaStep, status = SagaStatus.RUNNING) =>
  SagaInstanceEntity.reconstitute(
    {
      orderId: ORDER_ID,
      step,
      status,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    SAGA_ID,
  );

const makePart = (stockQuantity: number) =>
  PartEntity.create(
    {
      name: 'Pastilha',
      code: 'P-1',
      price: 50,
      stockQuantity,
      minStockQuantity: 0,
    },
    'p-1',
  );

function setup(params: {
  saga: SagaInstanceEntity | null;
  order?: ServiceOrderEntity | null;
  part?: PartEntity | null;
}) {
  const orderRepository = {
    findById: jest.fn().mockResolvedValue(params.order ?? null),
    update: jest.fn((order: ServiceOrderEntity) => Promise.resolve(order)),
  } as unknown as jest.Mocked<IServiceOrderRepository>;
  const sagaRepository = {
    findCurrentByOrderId: jest.fn().mockResolvedValue(params.saga),
    update: jest.fn((saga: SagaInstanceEntity) => Promise.resolve(saga)),
    appendLog: jest.fn(),
  } as unknown as jest.Mocked<ISagaRepository>;
  const partRepository = {
    findById: jest.fn().mockResolvedValue(params.part ?? null),
    update: jest.fn((part: PartEntity) => Promise.resolve(part)),
  } as unknown as jest.Mocked<IPartRepository>;
  const afterCommit: Array<() => unknown> = [];
  const transactions: ITransactionManager = {
    run: (fn) => fn(),
    afterCommit: (fn) => {
      afterCommit.push(fn);
    },
  };
  const emailService = {
    sendServiceOrderStatusUpdate: jest.fn(),
  } as jest.Mocked<IEmailNotificationService>;
  const metrics = {
    recordTransition: jest.fn(),
  } as unknown as jest.Mocked<ServiceOrderMetrics>;
  const logger = {
    log: jest.fn(),
    warn: jest.fn(),
  } as unknown as Logger;

  const useCase = new ProcessSagaEventUseCase(
    orderRepository,
    sagaRepository,
    partRepository,
    transactions,
    emailService,
    { approvalTimeoutMs: 48 * HOUR, paymentTimeoutMs: 24 * HOUR },
    metrics,
    logger,
  );
  return {
    useCase,
    orderRepository,
    sagaRepository,
    partRepository,
    emailService,
    metrics,
    runAfterCommit: async () => {
      for (const fn of afterCommit) await fn();
    },
  };
}

/** Mensagens que a execução gravou no outbox. */
const outbox = (repo: jest.Mocked<IServiceOrderRepository>) =>
  repo.update.mock.calls[0][1] ?? [];

describe('ProcessSagaEventUseCase', () => {
  it('manda para a DLQ um evento de OS sem saga', async () => {
    const { useCase } = setup({ saga: null });
    await expect(
      useCase.execute({ type: 'billing.budget.created', orderId: ORDER_ID }),
    ).rejects.toBeInstanceOf(InvalidMessageException);
  });

  it('ignora o evento de uma tentativa anterior da saga', async () => {
    const { useCase, sagaRepository, orderRepository } = setup({
      saga: makeSaga(SagaStep.BUDGET_CREATION),
    });
    const result = await useCase.execute({
      type: 'billing.budget.created',
      orderId: ORDER_ID,
      sagaId: 'saga-antiga',
    });
    expect(result.outcome).toBe('ignored');
    expect(orderRepository.update).not.toHaveBeenCalled();
    expect(sagaRepository.appendLog).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'IGNORED_STALE' }),
    );
  });

  it('devolve para a retentativa o evento que chegou antes da hora', async () => {
    const { useCase } = setup({ saga: makeSaga(SagaStep.EXECUTION_QUEUED) });
    await expect(
      useCase.execute({ type: 'execution.job.completed', orderId: ORDER_ID }),
    ).rejects.toBeInstanceOf(SagaEventOutOfOrderException);
  });

  it('registra como anomalia o evento para uma saga encerrada', async () => {
    const { useCase, sagaRepository } = setup({
      saga: makeSaga(SagaStep.FINISHED, SagaStatus.COMPLETED),
    });
    const result = await useCase.execute({
      type: 'execution.job.completed',
      orderId: ORDER_ID,
    });
    expect(result.outcome).toBe('ignored');
    expect(sagaRepository.appendLog).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'IGNORED_FINISHED' }),
    );
  });

  it('manda para a DLQ quando a OS da saga não existe', async () => {
    const { useCase } = setup({
      saga: makeSaga(SagaStep.BUDGET_CREATION),
      order: null,
    });
    await expect(
      useCase.execute({ type: 'billing.budget.created', orderId: ORDER_ID }),
    ).rejects.toBeInstanceOf(InvalidMessageException);
  });

  it('orçamento gerado: saga aguarda aprovação com prazo, sem mexer na OS', async () => {
    const saga = makeSaga(SagaStep.BUDGET_CREATION);
    const { useCase, emailService, runAfterCommit } = setup({
      saga,
      order: makeOrder(ServiceOrderStatus.AWAITING_APPROVAL),
    });
    const before = Date.now();

    await useCase.execute({
      type: 'billing.budget.created',
      orderId: ORDER_ID,
      sagaId: SAGA_ID,
      messageId: 'm-1',
    });
    await runAfterCommit();

    expect(saga.step).toBe(SagaStep.AWAITING_APPROVAL);
    expect(saga.deadlineAt!.getTime()).toBeGreaterThanOrEqual(
      before + 48 * HOUR,
    );
    expect(emailService.sendServiceOrderStatusUpdate).not.toHaveBeenCalled();
  });

  it('aprovado: reserva as peças, OS aguardando pagamento e e-mail depois do commit', async () => {
    const saga = makeSaga(SagaStep.AWAITING_APPROVAL);
    const part = makePart(5);
    const { useCase, partRepository, emailService, metrics, runAfterCommit } =
      setup({
        saga,
        order: makeOrder(ServiceOrderStatus.AWAITING_APPROVAL),
        part,
      });

    const result = await useCase.execute({
      type: 'billing.budget.approved',
      orderId: ORDER_ID,
    });

    expect(result.order?.status).toBe(ServiceOrderStatus.AWAITING_PAYMENT);
    expect(part.stockQuantity).toBe(3);
    expect(partRepository.update).toHaveBeenCalledWith(part);
    expect(saga.step).toBe(SagaStep.AWAITING_PAYMENT);
    expect(saga.deadlineAt).toBeInstanceOf(Date);

    // Nada sai antes do commit.
    expect(emailService.sendServiceOrderStatusUpdate).not.toHaveBeenCalled();
    await runAfterCommit();
    expect(emailService.sendServiceOrderStatusUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jane@example.com',
        status: ServiceOrderStatus.AWAITING_PAYMENT,
      }),
    );
    expect(metrics.recordTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        fromStatus: ServiceOrderStatus.AWAITING_APPROVAL,
        toStatus: ServiceOrderStatus.AWAITING_PAYMENT,
      }),
    );
  });

  it('aprovado sem estoque: cancela o orçamento com PARTS_UNAVAILABLE e não mexe no estoque', async () => {
    const saga = makeSaga(SagaStep.AWAITING_APPROVAL);
    const part = makePart(1);
    const { useCase, orderRepository, partRepository } = setup({
      saga,
      order: makeOrder(ServiceOrderStatus.AWAITING_APPROVAL),
      part,
    });

    const result = await useCase.execute({
      type: 'billing.budget.approved',
      orderId: ORDER_ID,
    });

    expect(result.order?.status).toBe(ServiceOrderStatus.CANCELED);
    expect(part.stockQuantity).toBe(1);
    expect(partRepository.update).not.toHaveBeenCalled();
    expect(saga.status).toBe(SagaStatus.COMPENSATING);
    expect(outbox(orderRepository)).toEqual([
      expect.objectContaining({
        routingKey: 'billing.budget.cancel',
        envelope: expect.objectContaining({
          sagaId: SAGA_ID,
          payload: { reason: 'PARTS_UNAVAILABLE' },
        }),
      }),
    ]);
  });

  it('aprovado com peça removida do catálogo: também cancela', async () => {
    const { useCase } = setup({
      saga: makeSaga(SagaStep.AWAITING_APPROVAL),
      order: makeOrder(ServiceOrderStatus.AWAITING_APPROVAL),
      part: null,
    });
    const result = await useCase.execute({
      type: 'billing.budget.approved',
      orderId: ORDER_ID,
    });
    expect(result.order?.status).toBe(ServiceOrderStatus.CANCELED);
  });

  it('pago: OS paga, prazo limpo e execution.job.enqueue no outbox', async () => {
    const saga = makeSaga(SagaStep.AWAITING_PAYMENT);
    saga.moveTo({
      step: SagaStep.AWAITING_PAYMENT,
      status: SagaStatus.RUNNING,
      deadlineAt: new Date(),
    });
    const { useCase, orderRepository } = setup({
      saga,
      order: makeOrder(ServiceOrderStatus.AWAITING_PAYMENT),
    });

    const result = await useCase.execute({
      type: 'billing.payment.confirmed',
      orderId: ORDER_ID,
    });

    expect(result.order?.status).toBe(ServiceOrderStatus.PAID);
    expect(saga.deadlineAt).toBeUndefined();
    expect(outbox(orderRepository)).toEqual([
      expect.objectContaining({
        exchange: 'saga.commands',
        routingKey: 'execution.job.enqueue',
        envelope: expect.objectContaining({
          payload: expect.objectContaining({
            orderNumber: 'OS001',
            priority: 'NORMAL',
          }),
        }),
      }),
    ]);
  });

  it('falha na execução: devolve as peças, cancela a OS e pede o estorno', async () => {
    const saga = makeSaga(SagaStep.EXECUTING);
    const part = makePart(3);
    const { useCase, orderRepository } = setup({
      saga,
      order: makeOrder(ServiceOrderStatus.IN_PROGRESS),
      part,
    });

    const result = await useCase.execute({
      type: 'execution.job.failed',
      orderId: ORDER_ID,
      detail: 'TECHNICAL_ISSUE: motor travado',
    });

    expect(result.order?.status).toBe(ServiceOrderStatus.CANCELED);
    expect(part.stockQuantity).toBe(5);
    expect(saga.step).toBe(SagaStep.REFUNDING);
    expect(saga.lastError).toBe('TECHNICAL_ISSUE: motor travado');
    expect(outbox(orderRepository)).toEqual([
      expect.objectContaining({
        routingKey: 'billing.payment.refund',
        envelope: expect.objectContaining({
          payload: { reason: 'EXECUTION_FAILED' },
        }),
      }),
    ]);
  });

  it('devolução de peça apagada do catálogo segue sem ela', async () => {
    const { useCase } = setup({
      saga: makeSaga(SagaStep.AWAITING_PAYMENT),
      order: makeOrder(ServiceOrderStatus.AWAITING_PAYMENT),
      part: null,
    });
    const result = await useCase.execute({
      type: 'billing.payment.failed',
      orderId: ORDER_ID,
    });
    expect(result.order?.status).toBe(ServiceOrderStatus.CANCELED);
  });

  it('job concluído: OS concluída e saga COMPLETED', async () => {
    const saga = makeSaga(SagaStep.EXECUTING);
    const { useCase } = setup({
      saga,
      order: makeOrder(ServiceOrderStatus.IN_PROGRESS),
    });
    const result = await useCase.execute({
      type: 'execution.job.completed',
      orderId: ORDER_ID,
    });
    expect(result.order?.status).toBe(ServiceOrderStatus.COMPLETED);
    expect(saga.status).toBe(SagaStatus.COMPLETED);
    expect(saga.step).toBe(SagaStep.FINISHED);
  });
});
