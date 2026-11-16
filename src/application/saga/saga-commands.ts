import { ServiceOrderEntity } from '@domain/entities/service-order/service-order.entity';
import {
  buildSagaCommand,
  OutgoingMessage,
} from '@domain/messaging/saga-message';
import { SagaCommandIntent } from './service-order-saga';

/** Contrato, seção 1: dinheiro é string decimal com duas casas. */
export function money(value: number): string {
  return value.toFixed(2);
}

/** Payload de `billing.budget.create` (contrato, seção 5). */
export function budgetCreatePayload(
  order: ServiceOrderEntity,
): Record<string, unknown> {
  return {
    orderNumber: order.orderNumber,
    // Dados gravados na OS na abertura: o Billing não consulta ninguém.
    customer: {
      id: order.customerId,
      name: order.customerName,
      email: order.customerEmail,
    },
    vehiclePlate: order.vehiclePlate,
    services: order.services.map((item) => ({
      serviceId: item.serviceId,
      name: item.serviceName,
      unitPrice: money(item.price),
      quantity: item.quantity,
    })),
    parts: order.parts.map((item) => ({
      partId: item.partId,
      name: item.partName,
      unitPrice: money(item.unitPrice),
      quantity: item.quantity,
    })),
    totalAmount: money(order.totalAmount),
  };
}

/** Payload de cada comando que o orquestrador decide mandar. */
export function commandPayload(
  intent: SagaCommandIntent,
  order: ServiceOrderEntity,
): Record<string, unknown> {
  switch (intent.type) {
    case 'execution.job.enqueue':
      return {
        orderNumber: order.orderNumber,
        vehiclePlate: order.vehiclePlate,
        priority: 'NORMAL',
        services: order.services.map((item) => ({
          name: item.serviceName,
          quantity: item.quantity,
        })),
        parts: order.parts.map((item) => ({
          name: item.partName,
          quantity: item.quantity,
        })),
      };
    case 'billing.budget.cancel':
    case 'billing.payment.refund':
    case 'execution.job.cancel':
      return { reason: intent.reason };
  }
}

/** Mensagem pronta para o outbox. */
export function toOutgoingMessage(params: {
  type: string;
  payload: Record<string, unknown>;
  sagaId: string;
  orderId: string;
  messageId: string;
  now: Date;
}): OutgoingMessage {
  return buildSagaCommand({
    messageId: params.messageId,
    sagaId: params.sagaId,
    orderId: params.orderId,
    type: params.type,
    occurredAt: params.now,
    payload: params.payload,
  });
}
