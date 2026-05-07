import { ServiceOrder } from './service-order.entity';
import { ServiceOrderStatus } from '../value-objects/service-order-status.value-object';

export interface IServiceOrderRepository {
  create(order: ServiceOrder): Promise<ServiceOrder>;
  findById(id: string): Promise<ServiceOrder | null>;
  findByOrderNumber(orderNumber: string): Promise<ServiceOrder | null>;
  findByCustomerId(customerId: string): Promise<ServiceOrder[]>;
  findByStatus(status: ServiceOrderStatus): Promise<ServiceOrder[]>;
  findAll(params: {
    skip?: number;
    take?: number;
    status?: ServiceOrderStatus;
  }): Promise<{ data: ServiceOrder[]; total: number }>;
  findAllCompleted(): Promise<ServiceOrder[]>;
  update(order: ServiceOrder): Promise<ServiceOrder>;
}

export const SERVICE_ORDER_REPOSITORY = Symbol('IServiceOrderRepository');
