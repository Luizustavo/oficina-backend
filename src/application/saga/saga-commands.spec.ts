import { ServiceOrderEntity } from '@domain/entities/service-order/service-order.entity';
import { ServiceOrderStatus } from '@domain/validators/value-objects/service-order-status.value-object';
import {
  budgetCreatePayload,
  commandPayload,
  money,
  toOutgoingMessage,
} from './saga-commands';

const order = ServiceOrderEntity.reconstitute(
  {
    orderNumber: 'OS2026000123',
    customerId: 'c-1',
    vehicleId: 'v-1',
    customerName: 'Maria Souza',
    customerEmail: 'maria@exemplo.com',
    vehiclePlate: 'ABC1D23',
    problemDescription: 'Troca de óleo',
    status: ServiceOrderStatus.AWAITING_APPROVAL,
    services: [
      {
        serviceId: 's-1',
        serviceName: 'Troca de óleo',
        price: 150,
        quantity: 1,
      },
    ],
    parts: [
      {
        partId: 'p-1',
        partName: 'Filtro de óleo',
        partCode: 'FO-1',
        unitPrice: 45.9,
        quantity: 1,
        totalPrice: 45.9,
      },
    ],
    totalAmount: 195.9,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  'o-1',
);

describe('saga commands (contrato, seção 5)', () => {
  it('formata dinheiro com duas casas', () => {
    expect(money(195.9)).toBe('195.90');
    expect(money(0)).toBe('0.00');
  });

  it('monta billing.budget.create com os dados gravados na OS', () => {
    expect(budgetCreatePayload(order)).toEqual({
      orderNumber: 'OS2026000123',
      customer: { id: 'c-1', name: 'Maria Souza', email: 'maria@exemplo.com' },
      vehiclePlate: 'ABC1D23',
      services: [
        {
          serviceId: 's-1',
          name: 'Troca de óleo',
          unitPrice: '150.00',
          quantity: 1,
        },
      ],
      parts: [
        {
          partId: 'p-1',
          name: 'Filtro de óleo',
          unitPrice: '45.90',
          quantity: 1,
        },
      ],
      totalAmount: '195.90',
    });
  });

  it('monta execution.job.enqueue sem valores', () => {
    expect(commandPayload({ type: 'execution.job.enqueue' }, order)).toEqual({
      orderNumber: 'OS2026000123',
      vehiclePlate: 'ABC1D23',
      priority: 'NORMAL',
      services: [{ name: 'Troca de óleo', quantity: 1 }],
      parts: [{ name: 'Filtro de óleo', quantity: 1 }],
    });
  });

  it.each([
    [{ type: 'billing.budget.cancel', reason: 'PAYMENT_TIMEOUT' }],
    [{ type: 'billing.payment.refund', reason: 'EXECUTION_FAILED' }],
    [{ type: 'execution.job.cancel', reason: 'MANUAL_CANCEL' }],
  ] as const)('compensação %o leva só o motivo', (intent) => {
    expect(commandPayload(intent, order)).toEqual({ reason: intent.reason });
  });

  it('embrulha o comando no envelope da saga', () => {
    const now = new Date('2026-11-16T12:00:00.000Z');
    expect(
      toOutgoingMessage({
        type: 'billing.budget.cancel',
        payload: { reason: 'MANUAL_CANCEL' },
        sagaId: 'saga-1',
        orderId: 'o-1',
        messageId: 'm-1',
        now,
      }),
    ).toEqual({
      exchange: 'saga.commands',
      routingKey: 'billing.budget.cancel',
      envelope: {
        messageId: 'm-1',
        sagaId: 'saga-1',
        orderId: 'o-1',
        type: 'billing.budget.cancel',
        version: 1,
        occurredAt: '2026-11-16T12:00:00.000Z',
        payload: { reason: 'MANUAL_CANCEL' },
      },
    });
  });
});
