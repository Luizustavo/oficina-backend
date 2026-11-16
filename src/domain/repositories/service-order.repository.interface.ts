import { ServiceOrderStatus } from '@domain/validators/value-objects/service-order-status.value-object';
import { ServiceOrderEntity } from '@domain/entities/service-order/service-order.entity';
import { OutgoingMessage } from '@domain/messaging/saga-message';

export abstract class IServiceOrderRepository {
  abstract findAllCompleted(): Promise<ServiceOrderEntity[]>;
  abstract findByCustomerId(customerId: string): Promise<ServiceOrderEntity[]>;
  abstract findById(id: string): Promise<ServiceOrderEntity | null>;
  abstract create(order: ServiceOrderEntity): Promise<ServiceOrderEntity>;
  /**
   * Persiste a ordem e, na mesma transação, grava `messages` no outbox
   * (ADR-010). Ou as duas coisas acontecem, ou nenhuma.
   */
  abstract update(
    order: ServiceOrderEntity,
    messages?: OutgoingMessage[],
  ): Promise<ServiceOrderEntity>;
  abstract findByOrderNumber(
    orderNumber: string,
  ): Promise<ServiceOrderEntity | null>;
  abstract findByStatus(
    status: ServiceOrderStatus,
  ): Promise<ServiceOrderEntity[]>;
  abstract findAll(params: {
    skip?: number;
    take?: number;
    status?: ServiceOrderStatus;
  }): Promise<{ data: ServiceOrderEntity[]; total: number }>;
}
