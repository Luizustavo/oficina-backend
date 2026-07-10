import { IServiceOrderRepository } from '@domain/repositories/service-order.repository.interface';
import { ServiceOrderResponseDto } from '@application/dtos/response/service-order.dto';
import { Injectable, Logger } from '@nestjs/common';
import { ServiceOrderStatus } from '@domain/validators/value-objects/service-order-status.value-object';
import { ServiceOrderMapper } from '@application/mappers/service-order.mapper';

@Injectable()
export class ListServiceOrdersByStatusUseCase {
  constructor(
    private readonly orderRepository: IServiceOrderRepository,
    private readonly logger: Logger,
  ) {}

  async execute(
    status: ServiceOrderStatus,
  ): Promise<ServiceOrderResponseDto[]> {
    this.logger.log(`Listing service orders with status: ${status}`);

    const orders = await this.orderRepository.findByStatus(status);

    this.logger.log(
      `Retrieved ${orders.length} service orders with status: ${status}`,
    );

    const response: ServiceOrderResponseDto[] = orders.map((order) =>
      ServiceOrderMapper.toResponse(order),
    );
    return response;
  }
}
