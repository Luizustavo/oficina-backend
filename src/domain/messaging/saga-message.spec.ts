import { InvalidMessageException } from '@shared/exceptions/domain.exceptions';
import {
  buildSagaCommand,
  parseSagaEnvelope,
  SagaExchange,
} from './saga-message';

const validEnvelope = {
  messageId: '6f1c2a0e-5b7d-4e8a-9c3f-1a2b3c4d5e6f',
  sagaId: '0d9e8f7a-6b5c-4d3e-2f1a-0b9c8d7e6f5a',
  orderId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  type: 'billing.budget.created',
  version: 1,
  occurredAt: '2026-11-14T13:45:00.000Z',
  payload: { budgetId: 'b-1' },
};

describe('buildSagaCommand', () => {
  it('should build a command for saga.commands routed by its type', () => {
    const message = buildSagaCommand({
      messageId: 'm-1',
      sagaId: 's-1',
      orderId: 'o-1',
      type: 'billing.budget.create',
      occurredAt: new Date('2026-11-14T13:45:00.000Z'),
      payload: { totalAmount: '350.00' },
    });

    expect(message.exchange).toBe(SagaExchange.COMMANDS);
    expect(message.routingKey).toBe('billing.budget.create');
    expect(message.envelope).toEqual({
      messageId: 'm-1',
      sagaId: 's-1',
      orderId: 'o-1',
      type: 'billing.budget.create',
      version: 1,
      occurredAt: '2026-11-14T13:45:00.000Z',
      payload: { totalAmount: '350.00' },
    });
  });

  it('should keep an explicit version', () => {
    const message = buildSagaCommand({
      messageId: 'm-1',
      sagaId: 's-1',
      orderId: 'o-1',
      type: 'billing.budget.create',
      version: 2,
      occurredAt: new Date(),
      payload: {},
    });
    expect(message.envelope.version).toBe(2);
  });
});

describe('parseSagaEnvelope', () => {
  it('should accept a valid envelope', () => {
    expect(parseSagaEnvelope(JSON.stringify(validEnvelope))).toEqual(
      validEnvelope,
    );
  });

  it.each([
    ['broken JSON', '{"messageId":'],
    ['a JSON array', '[]'],
    ['a JSON string', '"hello"'],
    ['null', 'null'],
  ])('should reject %s', (_label, body) => {
    expect(() => parseSagaEnvelope(body)).toThrow(InvalidMessageException);
  });

  it.each(['messageId', 'sagaId', 'orderId', 'type', 'occurredAt'])(
    'should reject an envelope without %s',
    (field) => {
      const body = JSON.stringify({ ...validEnvelope, [field]: undefined });
      expect(() => parseSagaEnvelope(body)).toThrow(InvalidMessageException);
    },
  );

  it('should reject an empty messageId', () => {
    const body = JSON.stringify({ ...validEnvelope, messageId: '  ' });
    expect(() => parseSagaEnvelope(body)).toThrow(InvalidMessageException);
  });

  it.each([0, -1, 1.5, '1', null])('should reject version %p', (version) => {
    const body = JSON.stringify({ ...validEnvelope, version });
    expect(() => parseSagaEnvelope(body)).toThrow(InvalidMessageException);
  });

  it.each([null, 'text', [], undefined])(
    'should reject payload %p',
    (payload) => {
      const body = JSON.stringify({ ...validEnvelope, payload });
      expect(() => parseSagaEnvelope(body)).toThrow(InvalidMessageException);
    },
  );
});
