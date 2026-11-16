import { SagaEnvelope } from '@domain/messaging/saga-message';
import { Injectable } from '@nestjs/common';

/**
 * Tratador de um tipo de mensagem da saga (ex.: `billing.budget.approved`).
 * Roda dentro da transação do consumidor: o que ele gravar pelos
 * repositórios é confirmado junto com o registro de "mensagem processada".
 * Lançar erro faz a mensagem ir para a retentativa; lançar
 * InvalidMessageException manda direto para a DLQ.
 */
export interface SagaMessageHandler {
  readonly type: string;
  /** Versões do payload que este tratador entende (contrato, seção 7). */
  readonly versions: number[];
  handle(envelope: SagaEnvelope): Promise<void>;
}

@Injectable()
export class SagaMessageHandlerRegistry {
  private readonly handlers = new Map<string, SagaMessageHandler>();

  register(handler: SagaMessageHandler): void {
    if (this.handlers.has(handler.type)) {
      throw new Error(`A handler for ${handler.type} is already registered`);
    }
    this.handlers.set(handler.type, handler);
  }

  /** Tratador para o tipo e a versão, ou `undefined` se não houver. */
  find(type: string, version: number): SagaMessageHandler | undefined {
    const handler = this.handlers.get(type);
    return handler?.versions.includes(version) ? handler : undefined;
  }
}
