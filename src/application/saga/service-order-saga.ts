import { SagaStatus, SagaStep } from '@domain/enums/saga.enum';

/**
 * Orquestrador da saga da OS (ADR-011): uma função pura. Recebe o estado da
 * saga e um evento e devolve a decisão, ou seja, o próximo passo, o que fazer
 * com a OS e com o estoque e quais comandos mandar. Não depende de Nest,
 * Prisma nem RabbitMQ: quem executa a decisão é o ProcessSagaEventUseCase.
 *
 * A matriz completa está na ADR-011 ("Passos e compensações") e no
 * PLANO-FASE-4, etapa 7.4.
 */

/** Eventos dos outros serviços (contratos-de-mensagens.md, seção 6). */
export const SagaEvent = {
  BUDGET_CREATED: 'billing.budget.created',
  BUDGET_CREATION_FAILED: 'billing.budget.creation-failed',
  BUDGET_APPROVED: 'billing.budget.approved',
  BUDGET_REJECTED: 'billing.budget.rejected',
  BUDGET_CANCELED: 'billing.budget.canceled',
  PAYMENT_CONFIRMED: 'billing.payment.confirmed',
  PAYMENT_FAILED: 'billing.payment.failed',
  PAYMENT_REFUNDED: 'billing.payment.refunded',
  PAYMENT_REFUND_FAILED: 'billing.payment.refund-failed',
  JOB_QUEUED: 'execution.job.queued',
  JOB_STARTED: 'execution.job.started',
  JOB_COMPLETED: 'execution.job.completed',
  JOB_FAILED: 'execution.job.failed',
  JOB_CANCELED: 'execution.job.canceled',
  // Eventos internos do OS: não vêm do broker.
  APPROVAL_TIMEOUT: 'saga.approval.timeout',
  PAYMENT_TIMEOUT: 'saga.payment.timeout',
  PARTS_UNAVAILABLE: 'saga.parts.unavailable',
  MANUAL_CANCEL: 'saga.manual-cancel',
} as const;

/** Eventos que chegam pela fila `os.saga-events`. */
export const BROKER_SAGA_EVENTS: string[] = Object.values(SagaEvent).filter(
  (type) => !type.startsWith('saga.'),
);

export type BudgetCancelReason =
  | 'BUDGET_REJECTED'
  | 'APPROVAL_TIMEOUT'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_TIMEOUT'
  | 'PARTS_UNAVAILABLE'
  | 'MANUAL_CANCEL';

export type RefundReason =
  | 'EXECUTION_FAILED'
  | 'MANUAL_CANCEL'
  | 'LATE_PAYMENT';

/** Comandos que a saga manda (contrato, seção 5); o payload é montado depois. */
export type SagaCommandIntent =
  | { type: 'billing.budget.cancel'; reason: BudgetCancelReason }
  | { type: 'billing.payment.refund'; reason: RefundReason }
  | { type: 'execution.job.enqueue' }
  | { type: 'execution.job.cancel'; reason: 'MANUAL_CANCEL' };

/** Métodos da ServiceOrderEntity que o evento dispara. */
export type OrderAction =
  | 'approveBudget'
  | 'confirmPayment'
  | 'startExecution'
  | 'complete'
  | 'cancel'
  | 'revertToDiagnosis';

/** Prazo a gravar na saga: o do passo novo, limpar ou manter o atual. */
export type DeadlineChange = 'approval' | 'payment' | 'clear' | 'keep';

export type SagaDecision =
  | {
      outcome: 'apply';
      step: SagaStep;
      status: SagaStatus;
      deadline: DeadlineChange;
      orderAction?: OrderAction;
      /** Baixar (reserve) ou devolver (release) as peças da OS no estoque. */
      stock?: 'reserve' | 'release';
      commands: SagaCommandIntent[];
      /** Motivo da falha, para `lastError`. */
      error?: string;
    }
  /** Confirmar sem efeito: passo já superado ou saga encerrada. */
  | { outcome: 'ignore'; reason: 'stale' | 'finished' }
  /** Evento de um passo à frente: volta para a retentativa. */
  | { outcome: 'retry-later'; reason: string };

export interface SagaState {
  step: SagaStep;
  status: SagaStatus;
}

/**
 * Posição de cada evento do caminho feliz, para separar "já superado" de
 * "à frente". O passo atual espera o evento de posição `expects`.
 */
const HAPPY_PATH: Record<string, number> = {
  [SagaEvent.BUDGET_CREATED]: 1,
  [SagaEvent.BUDGET_APPROVED]: 2,
  [SagaEvent.PAYMENT_CONFIRMED]: 3,
  [SagaEvent.JOB_QUEUED]: 4,
  [SagaEvent.JOB_STARTED]: 5,
  [SagaEvent.JOB_COMPLETED]: 6,
};

const EXPECTS: Partial<Record<SagaStep, number>> = {
  [SagaStep.BUDGET_CREATION]: 1,
  [SagaStep.AWAITING_APPROVAL]: 2,
  [SagaStep.AWAITING_PAYMENT]: 3,
  [SagaStep.EXECUTION_QUEUED]: 4,
  [SagaStep.EXECUTING]: 6,
};

const run = (
  step: SagaStep,
  rest: Omit<
    Extract<SagaDecision, { outcome: 'apply' }>,
    'outcome' | 'step' | 'status'
  >,
): SagaDecision => ({
  outcome: 'apply',
  step,
  status: SagaStatus.RUNNING,
  ...rest,
});

const compensate = (
  step: SagaStep,
  rest: Omit<
    Extract<SagaDecision, { outcome: 'apply' }>,
    'outcome' | 'step' | 'status'
  >,
): SagaDecision => ({
  outcome: 'apply',
  step,
  status: SagaStatus.COMPENSATING,
  ...rest,
});

const finish = (
  status: SagaStatus,
  rest: Omit<
    Extract<SagaDecision, { outcome: 'apply' }>,
    'outcome' | 'step' | 'status'
  >,
): SagaDecision => ({
  outcome: 'apply',
  step: SagaStep.FINISHED,
  status,
  ...rest,
});

/** Cancela a OS e o orçamento ainda não pago. */
const cancelBudget = (
  reason: BudgetCancelReason,
  releaseParts: boolean,
): SagaDecision =>
  compensate(SagaStep.CANCELING_BUDGET, {
    deadline: 'clear',
    orderAction: 'cancel',
    stock: releaseParts ? 'release' : undefined,
    commands: [{ type: 'billing.budget.cancel', reason }],
  });

const refundLatePayment = (): SagaDecision =>
  compensate(SagaStep.REFUNDING, {
    deadline: 'clear',
    commands: [{ type: 'billing.payment.refund', reason: 'LATE_PAYMENT' }],
  });

export function decideSagaTransition(
  state: SagaState,
  eventType: string,
  detail?: string,
): SagaDecision {
  const { step, status } = state;

  // Saga encerrada. Única exceção: pagamento confirmado depois de a saga já
  // ter cancelado o orçamento. O dinheiro entrou, então tem que ser devolvido.
  if (status !== SagaStatus.RUNNING && status !== SagaStatus.COMPENSATING) {
    if (
      status === SagaStatus.COMPENSATED &&
      eventType === SagaEvent.PAYMENT_CONFIRMED
    ) {
      return refundLatePayment();
    }
    return { outcome: 'ignore', reason: 'finished' };
  }

  switch (step) {
    case SagaStep.BUDGET_CREATION:
      if (eventType === SagaEvent.BUDGET_CREATED) {
        return run(SagaStep.AWAITING_APPROVAL, {
          deadline: 'approval',
          commands: [],
        });
      }
      if (eventType === SagaEvent.BUDGET_CREATION_FAILED) {
        // Compensação: a OS volta ao diagnóstico para a equipe corrigir os
        // itens e pedir aprovação de novo (nova saga).
        return finish(SagaStatus.COMPENSATED, {
          deadline: 'clear',
          orderAction: 'revertToDiagnosis',
          commands: [],
          error: detail ?? 'Budget could not be created',
        });
      }
      if (eventType === SagaEvent.MANUAL_CANCEL) {
        return cancelBudget('MANUAL_CANCEL', false);
      }
      break;

    case SagaStep.AWAITING_APPROVAL:
      if (eventType === SagaEvent.BUDGET_APPROVED) {
        return run(SagaStep.AWAITING_PAYMENT, {
          deadline: 'payment',
          orderAction: 'approveBudget',
          stock: 'reserve',
          commands: [],
        });
      }
      if (eventType === SagaEvent.BUDGET_REJECTED) {
        return cancelBudget('BUDGET_REJECTED', false);
      }
      if (eventType === SagaEvent.APPROVAL_TIMEOUT) {
        return cancelBudget('APPROVAL_TIMEOUT', false);
      }
      if (eventType === SagaEvent.PARTS_UNAVAILABLE) {
        return cancelBudget('PARTS_UNAVAILABLE', false);
      }
      if (eventType === SagaEvent.MANUAL_CANCEL) {
        return cancelBudget('MANUAL_CANCEL', false);
      }
      break;

    case SagaStep.AWAITING_PAYMENT:
      if (eventType === SagaEvent.PAYMENT_CONFIRMED) {
        return run(SagaStep.EXECUTION_QUEUED, {
          deadline: 'clear',
          orderAction: 'confirmPayment',
          commands: [{ type: 'execution.job.enqueue' }],
        });
      }
      if (eventType === SagaEvent.PAYMENT_FAILED) {
        return cancelBudget('PAYMENT_FAILED', true);
      }
      if (eventType === SagaEvent.PAYMENT_TIMEOUT) {
        return cancelBudget('PAYMENT_TIMEOUT', true);
      }
      if (eventType === SagaEvent.MANUAL_CANCEL) {
        return cancelBudget('MANUAL_CANCEL', true);
      }
      break;

    case SagaStep.EXECUTION_QUEUED:
    case SagaStep.EXECUTING:
      if (
        eventType === SagaEvent.JOB_QUEUED &&
        step === SagaStep.EXECUTION_QUEUED
      ) {
        // Só confirma que o job está na fila; a OS continua PAID.
        return run(SagaStep.EXECUTION_QUEUED, {
          deadline: 'keep',
          commands: [],
        });
      }
      if (
        eventType === SagaEvent.JOB_STARTED &&
        step === SagaStep.EXECUTION_QUEUED
      ) {
        return run(SagaStep.EXECUTING, {
          deadline: 'keep',
          orderAction: 'startExecution',
          commands: [],
        });
      }
      if (
        eventType === SagaEvent.JOB_COMPLETED &&
        step === SagaStep.EXECUTING
      ) {
        return finish(SagaStatus.COMPLETED, {
          deadline: 'clear',
          orderAction: 'complete',
          commands: [],
        });
      }
      if (eventType === SagaEvent.JOB_FAILED) {
        // A compensação que mexe com dinheiro: estorno no Mercado Pago.
        return compensate(SagaStep.REFUNDING, {
          deadline: 'clear',
          orderAction: 'cancel',
          stock: 'release',
          commands: [
            { type: 'billing.payment.refund', reason: 'EXECUTION_FAILED' },
          ],
          error: detail ?? 'Execution failed',
        });
      }
      if (eventType === SagaEvent.MANUAL_CANCEL) {
        // Primeiro tira o job da fila; o estorno vem com `job.canceled`.
        return compensate(SagaStep.CANCELING_EXECUTION, {
          deadline: 'clear',
          orderAction: 'cancel',
          stock: 'release',
          commands: [{ type: 'execution.job.cancel', reason: 'MANUAL_CANCEL' }],
        });
      }
      break;

    case SagaStep.CANCELING_BUDGET:
      if (eventType === SagaEvent.BUDGET_CANCELED) {
        return finish(SagaStatus.COMPENSATED, {
          deadline: 'clear',
          commands: [],
        });
      }
      if (eventType === SagaEvent.PAYMENT_CONFIRMED) {
        return refundLatePayment();
      }
      break;

    case SagaStep.CANCELING_EXECUTION:
      if (eventType === SagaEvent.JOB_CANCELED) {
        return compensate(SagaStep.REFUNDING, {
          deadline: 'clear',
          commands: [
            { type: 'billing.payment.refund', reason: 'MANUAL_CANCEL' },
          ],
        });
      }
      break;

    case SagaStep.REFUNDING:
      if (eventType === SagaEvent.PAYMENT_REFUNDED) {
        return finish(SagaStatus.COMPENSATED, {
          deadline: 'clear',
          commands: [],
        });
      }
      if (eventType === SagaEvent.PAYMENT_REFUND_FAILED) {
        // Compensação de dinheiro que falha não se resolve com mais
        // automação: FAILED gera alerta e exige intervenção manual.
        return finish(SagaStatus.FAILED, {
          deadline: 'clear',
          commands: [],
          error: detail ?? 'Refund failed',
        });
      }
      break;

    case SagaStep.FINISHED:
      return { outcome: 'ignore', reason: 'finished' };
  }

  // Evento que o passo atual não trata. Do caminho feliz e à frente do que o
  // passo espera: ainda não é a vez dele (ex.: `job.completed` antes de
  // `job.started`), volta para a retentativa. O resto já foi superado.
  const position = HAPPY_PATH[eventType];
  const expected = EXPECTS[step];
  if (
    status === SagaStatus.RUNNING &&
    position !== undefined &&
    expected !== undefined &&
    position > expected
  ) {
    return {
      outcome: 'retry-later',
      reason: `${eventType} arrived while the saga is at ${step}`,
    };
  }
  return { outcome: 'ignore', reason: 'stale' };
}
