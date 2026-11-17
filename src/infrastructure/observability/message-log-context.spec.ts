import { messageLogFields, withMessageLogContext } from './message-log-context';
import { SagaEnvelope } from '@domain/messaging/saga-message';

const envelope: SagaEnvelope = {
  messageId: 'message-1',
  sagaId: 'saga-1',
  orderId: 'order-1',
  type: 'billing.budget.created',
  version: 1,
  occurredAt: '2026-11-17T10:00:00.000Z',
  payload: {},
};

describe('message log context', () => {
  it('exposes the saga fields only while the message is processed', async () => {
    expect(messageLogFields()).toEqual({});

    const inside = await withMessageLogContext(envelope, async () => {
      await Promise.resolve();
      return messageLogFields();
    });

    expect(inside).toEqual({
      sagaId: 'saga-1',
      orderId: 'order-1',
      messageType: 'billing.budget.created',
      messageId: 'message-1',
    });
    expect(messageLogFields()).toEqual({});
  });
});
