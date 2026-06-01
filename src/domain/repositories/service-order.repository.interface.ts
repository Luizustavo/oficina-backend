import { ServiceOrderStatus } from '@domain/validators/value-objects/service-order-status.value-object';
import { ServiceOrderEntity } from '../entities/service-order/service-order.entity';

export interface IServiceOrderRepository {
  create(order: ServiceOrderEntity): Promise<ServiceOrderEntity>;
  findById(id: string): Promise<ServiceOrderEntity | null>;
  findByOrderNumber(orderNumber: string): Promise<ServiceOrderEntity | null>;
  findByCustomerId(customerId: string): Promise<ServiceOrderEntity[]>;
  findByStatus(status: ServiceOrderStatus): Promise<ServiceOrderEntity[]>;
  findAll(params: {
    skip?: number;
    take?: number;
    status?: ServiceOrderStatus;
  }): Promise<{ data: ServiceOrderEntity[]; total: number }>;
  findAllCompleted(): Promise<ServiceOrderEntity[]>;
  update(order: ServiceOrderEntity): Promise<ServiceOrderEntity>;
}

export const SERVICE_ORDER_REPOSITORY = Symbol('IServiceOrderRepository');
