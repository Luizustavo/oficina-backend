/**
 * Prazos da saga (ADR-011, "Timeouts"). Classe abstrata para ser injetada
 * como token, como os repositórios; os valores vêm de `sagaConfig()`.
 */
export abstract class SagaSettings {
  /** Quanto tempo o cliente tem para aprovar o orçamento. */
  abstract readonly approvalTimeoutMs: number;
  /** Quanto tempo o cliente tem para pagar depois de aprovar. */
  abstract readonly paymentTimeoutMs: number;
}
