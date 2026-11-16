import { InvalidMessageException } from '@shared/exceptions/domain.exceptions';

/**
 * Espera antes de cada nova tentativa: 5 s, 30 s e 2 min. Cada valor é o TTL
 * de uma fila `<fila>.retry.<n>` (contrato, seção 3). Depois da última, a
 * mensagem vai para a DLQ.
 */
export const RETRY_DELAYS_MS = [5_000, 30_000, 120_000] as const;

export type FailureDecision =
  /** Republicar em `<fila>.retry.<attempt>` e confirmar a original. */
  | { action: 'retry'; attempt: number; retryQueue: string }
  /** Tentativas esgotadas: publicar em `saga.dlx` e confirmar a original. */
  | { action: 'dead-letter' }
  /** Mensagem inválida: `nack` sem requeue, vai direto para a DLQ. */
  | { action: 'reject' };

export function retryQueueName(queue: string, attempt: number): string {
  return `${queue}.retry.${attempt}`;
}

export function deadLetterQueueName(queue: string): string {
  return `${queue}.dlq`;
}

/**
 * O que fazer com uma mensagem cujo processamento falhou (contrato, seção 4).
 *
 * @param retryCount valor do header `x-retry-count`: 0 na primeira entrega.
 */
export function decideOnFailure(
  queue: string,
  retryCount: number,
  error: unknown,
): FailureDecision {
  if (error instanceof InvalidMessageException) {
    return { action: 'reject' };
  }
  const attempt = Math.max(0, Math.floor(retryCount)) + 1;
  if (attempt > RETRY_DELAYS_MS.length) {
    return { action: 'dead-letter' };
  }
  return {
    action: 'retry',
    attempt,
    retryQueue: retryQueueName(queue, attempt),
  };
}
