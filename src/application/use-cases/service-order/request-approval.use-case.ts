import { IEmailNotificationService } from '@domain/services/email-notification.service.interface';
import { IServiceOrderRepository } from '@domain/repositories/service-order.repository.interface';
import { ServiceOrderResponseDto } from '@application/dtos/response/service-order.dto';
import { ICustomerRepository } from '@domain/repositories/customer.repository.interface';
import { Injectable, Logger } from '@nestjs/common';
import { ServiceOrderMetrics } from '@infrastructure/observability/service-order.metrics';
import { ServiceOrderMapper } from '@application/mappers/service-order.mapper';
import { NotFoundException } from '@shared/exceptions/domain.exceptions';

@Injectable()
export class RequestApprovalUseCase {
  constructor(
    private readonly orderRepository: IServiceOrderRepository,
    private readonly customerRepository: ICustomerRepository,
    private readonly emailService: IEmailNotificationService,
    private readonly metrics: ServiceOrderMetrics,
    private readonly logger: Logger,
  ) {}

  async execute(id: string): Promise<ServiceOrderResponseDto> {
    this.logger.log(`Requesting approval for service order: ${id}`);

    const order = await this.orderRepository.findById(id);
    if (!order) {
      this.logger.warn(`Service order not found with ID: ${id}`);
      throw new NotFoundException('ServiceOrder', id);
    }

    // Lidos antes da transição: `order` é mutado por `requestApproval()`,
    // e depois disso o status anterior não existe mais.
    const previousStatus = order.status;
    const previousStatusSince = order.updatedAt;

    order.requestApproval();
    const updated = await this.orderRepository.update(order);

    this.metrics.recordTransition({
      fromStatus: previousStatus,
      toStatus: updated.status,
      since: previousStatusSince,
    });

    const customer = await this.customerRepository.findById(updated.customerId);
    if (customer) {
      await this.emailService.sendServiceOrderStatusUpdate({
        to: customer.email,
        customerName: customer.name,
        orderNumber: updated.orderNumber,
        status: updated.status,
      });
    }

    this.logger.log(`Service order ${id} transitioned to AWAITING_APPROVAL`);

    const response: ServiceOrderResponseDto =
      ServiceOrderMapper.toResponse(updated);
    return response;
  }
}
