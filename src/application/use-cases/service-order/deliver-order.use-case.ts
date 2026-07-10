import { IServiceOrderRepository } from '@domain/repositories/service-order.repository.interface';
import { ServiceOrderResponseDto } from '@application/dtos/response/service-order.dto';
import { Injectable, Logger } from '@nestjs/common';
import { ServiceOrderMapper } from '@application/mappers/service-order.mapper';
import { NotFoundException } from '@shared/exceptions/domain.exceptions';

@Injectable()
export class DeliverOrderUseCase {
  constructor(
    private readonly orderRepository: IServiceOrderRepository,
    private readonly logger: Logger,
  ) {}

  async execute(id: string): Promise<ServiceOrderResponseDto> {
    this.logger.log(`Delivering service order: ${id}`);

    const order = await this.orderRepository.findById(id);
    if (!order) {
      this.logger.warn(`Service order not found with ID: ${id}`);
      throw new NotFoundException('ServiceOrder', id);
    }

    order.deliver();
    const updated = await this.orderRepository.update(order);

    this.logger.log(`Service order ${id} transitioned to DELIVERED`);

    const response: ServiceOrderResponseDto =
      ServiceOrderMapper.toResponse(updated);
    return response;
  }
}
