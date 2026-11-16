import {
  ISagaRepository,
  SagaLogOutcome,
} from '@domain/repositories/saga.repository.interface';
import { NotFoundException } from '@shared/exceptions/domain.exceptions';
import { SagaInstanceEntity } from '@domain/entities/saga/saga-instance.entity';
import { ExpireSagaDeadlinesUseCase } from './expire-saga-deadlines.use-case';
import { GetServiceOrderSagaUseCase } from './get-service-order-saga.use-case';
import { ProcessSagaEventUseCase } from './process-saga-event.use-case';
import { SagaStatus, SagaStep } from '@domain/enums/saga.enum';
import { Logger } from '@nestjs/common';

const logger = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
} as unknown as Logger;

const saga = (id: string, step: SagaStep, deadlineAt = new Date(0)) =>
  SagaInstanceEntity.reconstitute(
    {
      orderId: `order-${id}`,
      step,
      status: SagaStatus.RUNNING,
      deadlineAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    id,
  );

const sagaRepo = (overrides: Partial<jest.Mocked<ISagaRepository>>) =>
  overrides as unknown as jest.Mocked<ISagaRepository>;

describe('ExpireSagaDeadlinesUseCase', () => {
  it('manda o timeout do passo atual para cada saga com prazo vencido', async () => {
    const repo = sagaRepo({
      findExpired: jest
        .fn()
        .mockResolvedValue([
          saga('a', SagaStep.AWAITING_APPROVAL),
          saga('b', SagaStep.AWAITING_PAYMENT),
        ]),
    });
    const process = {
      execute: jest.fn().mockResolvedValue({ outcome: 'applied' }),
    } as unknown as jest.Mocked<ProcessSagaEventUseCase>;
    const now = new Date('2026-11-16T12:00:00Z');

    const applied = await new ExpireSagaDeadlinesUseCase(
      repo,
      process,
      logger,
    ).execute(now);

    expect(applied).toBe(2);
    expect(repo.findExpired).toHaveBeenCalledWith(now, 20);
    expect(process.execute).toHaveBeenCalledWith({
      type: 'saga.approval.timeout',
      orderId: 'order-a',
      sagaId: 'a',
    });
    expect(process.execute).toHaveBeenCalledWith({
      type: 'saga.payment.timeout',
      orderId: 'order-b',
      sagaId: 'b',
    });
  });

  it('ignora sagas em passos sem prazo e não conta as que foram ignoradas', async () => {
    const repo = sagaRepo({
      findExpired: jest
        .fn()
        .mockResolvedValue([
          saga('a', SagaStep.EXECUTING),
          saga('b', SagaStep.AWAITING_PAYMENT),
        ]),
    });
    const process = {
      execute: jest.fn().mockResolvedValue({ outcome: 'ignored' }),
    } as unknown as jest.Mocked<ProcessSagaEventUseCase>;

    const applied = await new ExpireSagaDeadlinesUseCase(
      repo,
      process,
      logger,
    ).execute();

    expect(applied).toBe(0);
    expect(process.execute).toHaveBeenCalledTimes(1);
  });

  it('uma saga com erro não impede as outras', async () => {
    const repo = sagaRepo({
      findExpired: jest
        .fn()
        .mockResolvedValue([
          saga('a', SagaStep.AWAITING_APPROVAL),
          saga('b', SagaStep.AWAITING_APPROVAL),
        ]),
    });
    const process = {
      execute: jest
        .fn()
        .mockRejectedValueOnce(new Error('deadlock'))
        .mockResolvedValueOnce({ outcome: 'applied' }),
    } as unknown as jest.Mocked<ProcessSagaEventUseCase>;

    const applied = await new ExpireSagaDeadlinesUseCase(
      repo,
      process,
      logger,
    ).execute();

    expect(applied).toBe(1);
    expect(process.execute).toHaveBeenCalledTimes(2);
  });
});

describe('GetServiceOrderSagaUseCase', () => {
  it('devolve a saga atual com o histórico', async () => {
    const current = saga('s-1', SagaStep.AWAITING_PAYMENT);
    const repo = sagaRepo({
      findCurrentByOrderId: jest.fn().mockResolvedValue(current),
      findLogs: jest.fn().mockResolvedValue([
        {
          sagaId: 's-1',
          step: SagaStep.BUDGET_CREATION,
          eventType: 'billing.budget.create',
          outcome: SagaLogOutcome.STARTED,
        },
        {
          sagaId: 's-1',
          step: SagaStep.AWAITING_PAYMENT,
          eventType: 'billing.budget.approved',
          messageId: 'm-2',
          outcome: SagaLogOutcome.APPLIED,
        },
      ]),
    });

    const result = await new GetServiceOrderSagaUseCase(repo, logger).execute(
      'order-s-1',
    );

    expect(result).toMatchObject({
      sagaId: 's-1',
      orderId: 'order-s-1',
      status: 'RUNNING',
      step: 'AWAITING_PAYMENT',
      deadlineAt: new Date(0),
    });
    expect(result.history.map((h) => h.eventType)).toEqual([
      'billing.budget.create',
      'billing.budget.approved',
    ]);
    expect(repo.findLogs).toHaveBeenCalledWith('s-1');
  });

  it('responde 404 para OS sem saga', async () => {
    const repo = sagaRepo({
      findCurrentByOrderId: jest.fn().mockResolvedValue(null),
    });
    await expect(
      new GetServiceOrderSagaUseCase(repo, logger).execute('x'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
