import { IServiceOrderRepository } from '@domain/repositories/service-order.repository.interface';
import { ServiceOrderResponseDto } from '@application/dtos/response/service-order.dto';
import { PaginatedResponseDto } from '@application/dtos/common.dto';
import { Injectable, Logger } from '@nestjs/common';
import { ServiceOrderStatus } from '@domain/validators/value-objects/service-order-status.value-object';
import { ServiceOrderMapper } from '@application/mappers/service-order.mapper';
import { PaginationMapper } from '@application/mappers/pagination.mapper';

@Injectable()
export class ListServiceOrdersUseCase {
  constructor(
    private readonly orderRepository: IServiceOrderRepository,
    private readonly logger: Logger,
  ) {}

  async execute(params: {
    page?: number;
    limit?: number;
    status?: ServiceOrderStatus;
  }): Promise<PaginatedResponseDto<ServiceOrderResponseDto>> {
    this.logger.log(
      `Listing service orders with pagination - Page: ${params.page}, Limit: ${params.limit}`,
    );

    const { page, limit, skip } = PaginationMapper.resolveParams(params);
    const { data, total } = await this.orderRepository.findAll({
      skip,
      take: limit,
      status: params.status,
    });

    this.logger.log(`Retrieved ${data.length} service orders, Total: ${total}`);

    const response: PaginatedResponseDto<ServiceOrderResponseDto> =
      PaginationMapper.toResponse(data, total, page, limit, (order) =>
        ServiceOrderMapper.toResponse(order),
      );
    return response;
  }
}
