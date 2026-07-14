import { ServiceOrderStatus } from '@domain/validators/value-objects/service-order-status.value-object';

export abstract class IEmailNotificationService {
  abstract sendServiceOrderStatusUpdate(params: {
    to: string;
    customerName: string;
    orderNumber: string;
    status: ServiceOrderStatus;
  }): Promise<void>;
}
