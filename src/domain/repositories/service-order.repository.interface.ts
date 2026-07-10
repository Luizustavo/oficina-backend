import { ServiceOrderStatus } from '@domain/validators/value-objects/service-order-status.value-object';
import { ServiceOrderEntity } from '@domain/entities/service-order/service-order.entity';

export abstract class IServiceOrderRepository {
  abstract findAllCompleted(): Promise<ServiceOrderEntity[]>;
  abstract findByCustomerId(customerId: string): Promise<ServiceOrderEntity[]>;
  abstract findById(id: string): Promise<ServiceOrderEntity | null>;
  abstract create(order: ServiceOrderEntity): Promise<ServiceOrderEntity>;
  abstract update(order: ServiceOrderEntity): Promise<ServiceOrderEntity>;
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
