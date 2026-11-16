import { OutgoingMessage } from '@domain/messaging/saga-message';

/**
 * Porta de saída para o broker. Usada só pelo relay do outbox: casos de uso
 * nunca publicam direto, eles gravam a mensagem no outbox na mesma transação
 * da mudança de estado (ADR-010).
 */
export abstract class IMessagePublisher {
  /**
   * Resolve só depois de o broker confirmar que recebeu e roteou a mensagem
   * (publisher confirms). Rejeita se o broker estiver fora, se a confirmação
   * não chegar a tempo ou se nenhuma fila receber a mensagem.
   */
  abstract publish(
    message: OutgoingMessage,
    trace?: { traceparent?: string; tracestate?: string },
  ): Promise<void>;
}
