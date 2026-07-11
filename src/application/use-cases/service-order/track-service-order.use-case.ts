import { TrackServiceOrderResponseDto } from '@application/dtos/response/service-order.dto';
import { IServiceOrderRepository } from '@domain/repositories/service-order.repository.interface';
import { Injectable, Logger } from '@nestjs/common';
import { ServiceOrderMapper } from '@application/mappers/service-order.mapper';
import { NotFoundException } from '@shared/exceptions/domain.exceptions';

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

    const response: TrackServiceOrderResponseDto =
      ServiceOrderMapper.toTrackResponse(order);
    return response;
  }
}
