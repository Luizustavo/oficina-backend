import {
  BudgetDecisionRequestDto,
  BudgetDecision,
} from '@application/dtos/request/service-order.dto';
import { IEmailNotificationService } from '@domain/services/email-notification.service.interface';
import { IServiceOrderRepository } from '@domain/repositories/service-order.repository.interface';
import { ServiceOrderResponseDto } from '@application/dtos/response/service-order.dto';
import { ICustomerRepository } from '@domain/repositories/customer.repository.interface';
import { Injectable, Logger } from '@nestjs/common';
import { ServiceOrderMapper } from '@application/mappers/service-order.mapper';
import { NotFoundException } from '@shared/exceptions/domain.exceptions';

@Injectable()
export class ProcessBudgetDecisionUseCase {
  constructor(
    private readonly orderRepository: IServiceOrderRepository,
    private readonly customerRepository: ICustomerRepository,
    private readonly emailService: IEmailNotificationService,
    private readonly logger: Logger,
  ) {}

  async execute(
    orderNumber: string,
    dto: BudgetDecisionRequestDto,
  ): Promise<ServiceOrderResponseDto> {
    this.logger.log(
      `Processing external budget decision for order ${orderNumber}: ${dto.decision}`,
    );

    const order = await this.orderRepository.findByOrderNumber(orderNumber);
    if (!order) {
      this.logger.warn(
        `Service order not found with order number: ${orderNumber}`,
      );
      throw new NotFoundException('ServiceOrder', orderNumber);
    }

    if (dto.decision === BudgetDecision.APPROVED) {
      order.approve();
    } else {
      order.cancel();
    }
    const updated = await this.orderRepository.update(order);

    const customer = await this.customerRepository.findById(updated.customerId);
    if (customer) {
      await this.emailService.sendServiceOrderStatusUpdate({
        to: customer.email,
        customerName: customer.name,
        orderNumber: updated.orderNumber,
        status: updated.status,
      });
    }

    this.logger.log(
      `Service order ${orderNumber} budget decision processed, transitioned to ${updated.status}`,
    );

    const response: ServiceOrderResponseDto =
      ServiceOrderMapper.toResponse(updated);
    return response;
  }
}
