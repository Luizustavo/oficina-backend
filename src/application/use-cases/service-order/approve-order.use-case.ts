import { IEmailNotificationService } from '@domain/services/email-notification.service.interface';
import { IServiceOrderRepository } from '@domain/repositories/service-order.repository.interface';
import { ServiceOrderResponseDto } from '@application/dtos/response/service-order.dto';
import { ICustomerRepository } from '@domain/repositories/customer.repository.interface';
import { Injectable, Logger } from '@nestjs/common';
import { ServiceOrderMapper } from '@application/mappers/service-order.mapper';
import { NotFoundException } from '@shared/exceptions/domain.exceptions';

@Injectable()
export class ApproveOrderUseCase {
  constructor(
    private readonly orderRepository: IServiceOrderRepository,
    private readonly customerRepository: ICustomerRepository,
    private readonly emailService: IEmailNotificationService,
    private readonly logger: Logger,
  ) {}

  async execute(id: string): Promise<ServiceOrderResponseDto> {
    this.logger.log(`Approving service order: ${id}`);

    const order = await this.orderRepository.findById(id);
    if (!order) {
      this.logger.warn(`Service order not found with ID: ${id}`);
      throw new NotFoundException('ServiceOrder', id);
    }

    order.approve();
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

    this.logger.log(`Service order ${id} transitioned to IN_PROGRESS`);

    const response: ServiceOrderResponseDto =
      ServiceOrderMapper.toResponse(updated);
    return response;
  }
}
