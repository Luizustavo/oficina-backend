import { Injectable, Logger } from '@nestjs/common';
import { IServiceOrderRepository } from '@domain/repositories/service-order.repository.interface';
import { NotFoundException } from '@shared/exceptions/domain.exceptions';
import { TrackServiceOrderResponseDto } from '@application/dtos/response/service-order.dto';

@Injectable()
export class TrackServiceOrderUseCase {
  constructor(
    private readonly orderRepository: IServiceOrderRepository,
    private readonly logger: Logger,
  ) {}

  async execute(orderNumber: string): Promise<TrackServiceOrderResponseDto> {
    this.logger.log(`Tracking service order by number: ${orderNumber}`);

    const order = await this.orderRepository.findByOrderNumber(orderNumber);
    if (!order) {
      this.logger.warn(`Service order not found with number: ${orderNumber}`);
      throw new NotFoundException('ServiceOrder', orderNumber);
    }

    return {
      orderNumber: order.orderNumber,
      status: order.status,
      problemDescription: order.problemDescription,
      services: order.services,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
      approvedAt: order.approvedAt,
      startedAt: order.startedAt,
      finishedAt: order.finishedAt,
      deliveredAt: order.deliveredAt,
    };
  }
}
