import { SagaEnvelope } from '@domain/messaging/saga-message';
import { AsyncLocalStorage } from 'node:async_hooks';

type MessageLogFields = {
  sagaId: string;
  orderId: string;
  messageType: string;
  messageId: string;
};

const storage = new AsyncLocalStorage<MessageLogFields>();

/** Toda linha de log escrita dentro de `run` sai com o sagaId e o orderId da mensagem. */
export function withMessageLogContext<T>(
  envelope: SagaEnvelope,
  run: () => T,
): T {
  return storage.run(
    {
      sagaId: envelope.sagaId,
      orderId: envelope.orderId,
      messageType: envelope.type,
      messageId: envelope.messageId,
    },
    run,
  );
}

export function messageLogFields(): Partial<MessageLogFields> {
  return storage.getStore() ?? {};
}
