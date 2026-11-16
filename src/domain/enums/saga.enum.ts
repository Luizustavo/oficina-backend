/** Situação geral da saga (ADR-011, "Estado da saga"). */
export enum SagaStatus {
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  /** Desfazendo o que já foi feito: esperando a resposta de uma compensação. */
  COMPENSATING = 'COMPENSATING',
  COMPENSATED = 'COMPENSATED',
  /** A compensação falhou (ex.: estorno recusado): exige intervenção manual. */
  FAILED = 'FAILED',
}

/** Em que ponto do fluxo a saga está, ou seja, qual resposta ela espera. */
export enum SagaStep {
  /** `billing.budget.create` enviado; espera `budget.created` ou `creation-failed`. */
  BUDGET_CREATION = 'BUDGET_CREATION',
  /** Orçamento gerado; espera o cliente aprovar ou recusar (com prazo). */
  AWAITING_APPROVAL = 'AWAITING_APPROVAL',
  /** Aprovado, peças reservadas; espera o pagamento (com prazo). */
  AWAITING_PAYMENT = 'AWAITING_PAYMENT',
  /** Pago, `execution.job.enqueue` enviado; espera o início do reparo. */
  EXECUTION_QUEUED = 'EXECUTION_QUEUED',
  /** Reparo começou; espera `job.completed` ou `job.failed`. */
  EXECUTING = 'EXECUTING',
  /** Compensação: espera `billing.budget.canceled`. */
  CANCELING_BUDGET = 'CANCELING_BUDGET',
  /** Compensação: espera `execution.job.canceled` (depois vem o estorno). */
  CANCELING_EXECUTION = 'CANCELING_EXECUTION',
  /** Compensação: espera `billing.payment.refunded` ou `refund-failed`. */
  REFUNDING = 'REFUNDING',
  FINISHED = 'FINISHED',
}
