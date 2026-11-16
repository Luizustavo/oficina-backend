import { SagaStatus, SagaStep } from '@domain/enums/saga.enum';
import {
  BROKER_SAGA_EVENTS,
  decideSagaTransition,
  SagaEvent,
  SagaState,
} from './service-order-saga';

const running = (step: SagaStep): SagaState => ({
  step,
  status: SagaStatus.RUNNING,
});
const compensating = (step: SagaStep): SagaState => ({
  step,
  status: SagaStatus.COMPENSATING,
});

describe('decideSagaTransition (ADR-011)', () => {
  describe('caminho feliz', () => {
    it('orçamento gerado → aguarda aprovação, com prazo', () => {
      expect(
        decideSagaTransition(
          running(SagaStep.BUDGET_CREATION),
          SagaEvent.BUDGET_CREATED,
        ),
      ).toEqual({
        outcome: 'apply',
        step: SagaStep.AWAITING_APPROVAL,
        status: SagaStatus.RUNNING,
        deadline: 'approval',
        commands: [],
      });
    });

    it('aprovado → OS aguardando pagamento, peças reservadas, prazo de pagamento', () => {
      expect(
        decideSagaTransition(
          running(SagaStep.AWAITING_APPROVAL),
          SagaEvent.BUDGET_APPROVED,
        ),
      ).toEqual({
        outcome: 'apply',
        step: SagaStep.AWAITING_PAYMENT,
        status: SagaStatus.RUNNING,
        deadline: 'payment',
        orderAction: 'approveBudget',
        stock: 'reserve',
        commands: [],
      });
    });

    it('pago → OS paga e job enfileirado no Execution', () => {
      expect(
        decideSagaTransition(
          running(SagaStep.AWAITING_PAYMENT),
          SagaEvent.PAYMENT_CONFIRMED,
        ),
      ).toEqual({
        outcome: 'apply',
        step: SagaStep.EXECUTION_QUEUED,
        status: SagaStatus.RUNNING,
        deadline: 'clear',
        orderAction: 'confirmPayment',
        commands: [{ type: 'execution.job.enqueue' }],
      });
    });

    it('job na fila → nada muda na OS', () => {
      expect(
        decideSagaTransition(
          running(SagaStep.EXECUTION_QUEUED),
          SagaEvent.JOB_QUEUED,
        ),
      ).toMatchObject({
        outcome: 'apply',
        step: SagaStep.EXECUTION_QUEUED,
        commands: [],
      });
    });

    it('job iniciado → OS em execução', () => {
      expect(
        decideSagaTransition(
          running(SagaStep.EXECUTION_QUEUED),
          SagaEvent.JOB_STARTED,
        ),
      ).toMatchObject({
        outcome: 'apply',
        step: SagaStep.EXECUTING,
        orderAction: 'startExecution',
      });
    });

    it('job concluído → OS concluída e saga COMPLETED', () => {
      expect(
        decideSagaTransition(
          running(SagaStep.EXECUTING),
          SagaEvent.JOB_COMPLETED,
        ),
      ).toEqual({
        outcome: 'apply',
        step: SagaStep.FINISHED,
        status: SagaStatus.COMPLETED,
        deadline: 'clear',
        orderAction: 'complete',
        commands: [],
      });
    });
  });

  describe('falhas e compensações', () => {
    it('orçamento não gerado → OS volta ao diagnóstico, saga COMPENSATED', () => {
      expect(
        decideSagaTransition(
          running(SagaStep.BUDGET_CREATION),
          SagaEvent.BUDGET_CREATION_FAILED,
          'INVALID_ITEMS',
        ),
      ).toEqual({
        outcome: 'apply',
        step: SagaStep.FINISHED,
        status: SagaStatus.COMPENSATED,
        deadline: 'clear',
        orderAction: 'revertToDiagnosis',
        commands: [],
        error: 'INVALID_ITEMS',
      });
    });

    it.each([
      [SagaEvent.BUDGET_REJECTED, 'BUDGET_REJECTED'],
      [SagaEvent.APPROVAL_TIMEOUT, 'APPROVAL_TIMEOUT'],
      [SagaEvent.PARTS_UNAVAILABLE, 'PARTS_UNAVAILABLE'],
      [SagaEvent.MANUAL_CANCEL, 'MANUAL_CANCEL'],
    ])(
      'na aprovação, %s → cancela OS e orçamento (%s), sem peças a devolver',
      (event, reason) => {
        expect(
          decideSagaTransition(running(SagaStep.AWAITING_APPROVAL), event),
        ).toEqual({
          outcome: 'apply',
          step: SagaStep.CANCELING_BUDGET,
          status: SagaStatus.COMPENSATING,
          deadline: 'clear',
          orderAction: 'cancel',
          stock: undefined,
          commands: [{ type: 'billing.budget.cancel', reason }],
        });
      },
    );

    it('cancelamento manual antes de o orçamento existir também cancela no Billing', () => {
      expect(
        decideSagaTransition(
          running(SagaStep.BUDGET_CREATION),
          SagaEvent.MANUAL_CANCEL,
        ),
      ).toMatchObject({
        step: SagaStep.CANCELING_BUDGET,
        orderAction: 'cancel',
        commands: [{ type: 'billing.budget.cancel', reason: 'MANUAL_CANCEL' }],
      });
    });

    it.each([
      [SagaEvent.PAYMENT_FAILED, 'PAYMENT_FAILED'],
      [SagaEvent.PAYMENT_TIMEOUT, 'PAYMENT_TIMEOUT'],
      [SagaEvent.MANUAL_CANCEL, 'MANUAL_CANCEL'],
    ])(
      'no pagamento, %s → cancela OS e orçamento (%s) e devolve as peças',
      (event, reason) => {
        expect(
          decideSagaTransition(running(SagaStep.AWAITING_PAYMENT), event),
        ).toMatchObject({
          step: SagaStep.CANCELING_BUDGET,
          status: SagaStatus.COMPENSATING,
          orderAction: 'cancel',
          stock: 'release',
          commands: [{ type: 'billing.budget.cancel', reason }],
        });
      },
    );

    it.each([SagaStep.EXECUTION_QUEUED, SagaStep.EXECUTING])(
      'falha na execução (%s) → estorno, peças devolvidas, OS cancelada',
      (step) => {
        expect(
          decideSagaTransition(
            running(step),
            SagaEvent.JOB_FAILED,
            'TECHNICAL_ISSUE',
          ),
        ).toEqual({
          outcome: 'apply',
          step: SagaStep.REFUNDING,
          status: SagaStatus.COMPENSATING,
          deadline: 'clear',
          orderAction: 'cancel',
          stock: 'release',
          commands: [
            { type: 'billing.payment.refund', reason: 'EXECUTION_FAILED' },
          ],
          error: 'TECHNICAL_ISSUE',
        });
      },
    );

    it.each([SagaStep.EXECUTION_QUEUED, SagaStep.EXECUTING])(
      'cancelamento manual com OS paga (%s) → primeiro tira o job da fila',
      (step) => {
        expect(
          decideSagaTransition(running(step), SagaEvent.MANUAL_CANCEL),
        ).toMatchObject({
          step: SagaStep.CANCELING_EXECUTION,
          orderAction: 'cancel',
          stock: 'release',
          commands: [{ type: 'execution.job.cancel', reason: 'MANUAL_CANCEL' }],
        });
      },
    );

    it('job cancelado → pede o estorno', () => {
      expect(
        decideSagaTransition(
          compensating(SagaStep.CANCELING_EXECUTION),
          SagaEvent.JOB_CANCELED,
        ),
      ).toMatchObject({
        step: SagaStep.REFUNDING,
        status: SagaStatus.COMPENSATING,
        commands: [{ type: 'billing.payment.refund', reason: 'MANUAL_CANCEL' }],
      });
      expect(
        decideSagaTransition(
          compensating(SagaStep.CANCELING_EXECUTION),
          SagaEvent.JOB_CANCELED,
        ),
      ).not.toHaveProperty('orderAction');
    });

    it('orçamento cancelado → saga COMPENSATED', () => {
      expect(
        decideSagaTransition(
          compensating(SagaStep.CANCELING_BUDGET),
          SagaEvent.BUDGET_CANCELED,
        ),
      ).toMatchObject({
        step: SagaStep.FINISHED,
        status: SagaStatus.COMPENSATED,
      });
    });

    it('estorno concluído → saga COMPENSATED', () => {
      expect(
        decideSagaTransition(
          compensating(SagaStep.REFUNDING),
          SagaEvent.PAYMENT_REFUNDED,
        ),
      ).toMatchObject({
        step: SagaStep.FINISHED,
        status: SagaStatus.COMPENSATED,
      });
    });

    it('estorno recusado → saga FAILED, exige intervenção manual', () => {
      expect(
        decideSagaTransition(
          compensating(SagaStep.REFUNDING),
          SagaEvent.PAYMENT_REFUND_FAILED,
          'MP recusou',
        ),
      ).toMatchObject({
        step: SagaStep.FINISHED,
        status: SagaStatus.FAILED,
        error: 'MP recusou',
      });
    });
  });

  describe('pagamento depois do cancelamento', () => {
    it('confirmado enquanto o orçamento é cancelado → estorno LATE_PAYMENT', () => {
      expect(
        decideSagaTransition(
          compensating(SagaStep.CANCELING_BUDGET),
          SagaEvent.PAYMENT_CONFIRMED,
        ),
      ).toEqual({
        outcome: 'apply',
        step: SagaStep.REFUNDING,
        status: SagaStatus.COMPENSATING,
        deadline: 'clear',
        commands: [{ type: 'billing.payment.refund', reason: 'LATE_PAYMENT' }],
      });
    });

    it('confirmado com a saga já COMPENSATED → reabre para estornar', () => {
      expect(
        decideSagaTransition(
          { step: SagaStep.FINISHED, status: SagaStatus.COMPENSATED },
          SagaEvent.PAYMENT_CONFIRMED,
        ),
      ).toMatchObject({
        step: SagaStep.REFUNDING,
        status: SagaStatus.COMPENSATING,
        commands: [{ type: 'billing.payment.refund', reason: 'LATE_PAYMENT' }],
      });
    });
  });

  describe('eventos fora de ordem', () => {
    it.each([
      [SagaStep.AWAITING_APPROVAL, SagaEvent.BUDGET_CREATED],
      [SagaStep.AWAITING_PAYMENT, SagaEvent.BUDGET_APPROVED],
      [SagaStep.EXECUTION_QUEUED, SagaEvent.PAYMENT_CONFIRMED],
      [SagaStep.EXECUTING, SagaEvent.JOB_QUEUED],
      [SagaStep.EXECUTING, SagaEvent.JOB_STARTED],
    ])('em %s, %s já foi superado → ignora', (step, event) => {
      expect(decideSagaTransition(running(step), event)).toEqual({
        outcome: 'ignore',
        reason: 'stale',
      });
    });

    it.each([
      [SagaStep.BUDGET_CREATION, SagaEvent.BUDGET_APPROVED],
      [SagaStep.AWAITING_APPROVAL, SagaEvent.PAYMENT_CONFIRMED],
      [SagaStep.AWAITING_PAYMENT, SagaEvent.JOB_STARTED],
      [SagaStep.EXECUTION_QUEUED, SagaEvent.JOB_COMPLETED],
    ])('em %s, %s está à frente → retentativa', (step, event) => {
      expect(decideSagaTransition(running(step), event)).toMatchObject({
        outcome: 'retry-later',
      });
    });

    it('evento do caminho feliz durante uma compensação → ignora', () => {
      expect(
        decideSagaTransition(
          compensating(SagaStep.CANCELING_EXECUTION),
          SagaEvent.JOB_COMPLETED,
        ),
      ).toEqual({ outcome: 'ignore', reason: 'stale' });
    });

    it('prazo vencido fora do passo dele → ignora', () => {
      expect(
        decideSagaTransition(
          running(SagaStep.AWAITING_PAYMENT),
          SagaEvent.APPROVAL_TIMEOUT,
        ),
      ).toEqual({ outcome: 'ignore', reason: 'stale' });
    });

    it.each([SagaStatus.COMPLETED, SagaStatus.FAILED, SagaStatus.COMPENSATED])(
      'saga %s → qualquer outro evento é ignorado como anomalia',
      (status) => {
        expect(
          decideSagaTransition(
            { step: SagaStep.FINISHED, status },
            SagaEvent.JOB_COMPLETED,
          ),
        ).toEqual({ outcome: 'ignore', reason: 'finished' });
      },
    );

    it('cancelamento manual numa saga encerrada é ignorado', () => {
      expect(
        decideSagaTransition(
          { step: SagaStep.FINISHED, status: SagaStatus.COMPLETED },
          SagaEvent.MANUAL_CANCEL,
        ),
      ).toEqual({ outcome: 'ignore', reason: 'finished' });
    });
  });

  it('lista só os eventos que chegam pelo broker', () => {
    expect(BROKER_SAGA_EVENTS).toHaveLength(14);
    expect(BROKER_SAGA_EVENTS).not.toContain(SagaEvent.MANUAL_CANCEL);
    expect(BROKER_SAGA_EVENTS).toContain(SagaEvent.PAYMENT_REFUND_FAILED);
  });
});
