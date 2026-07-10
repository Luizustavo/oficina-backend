import { IServiceOrderRepository } from '@domain/repositories/service-order.repository.interface';
import { ServiceOrderResponseDto } from '@application/dtos/response/service-order.dto';
import { Injectable, Logger } from '@nestjs/common';
import { ServiceOrderMapper } from '@application/mappers/service-order.mapper';

@Injectable()
export class ListServiceOrdersByCustomerUseCase {
  constructor(
    private readonly orderRepository: IServiceOrderRepository,
    private readonly logger: Logger,
  ) {}

  async execute(customerId: string): Promise<ServiceOrderResponseDto[]> {
    this.logger.log(`Listing service orders for customer: ${customerId}`);

    const orders = await this.orderRepository.findByCustomerId(customerId);

    this.logger.log(
      `Retrieved ${orders.length} service orders for customer: ${customerId}`,
    );

    const response: ServiceOrderResponseDto[] = orders.map((order) =>
      ServiceOrderMapper.toResponse(order),
    );
    return response;
  }
}
