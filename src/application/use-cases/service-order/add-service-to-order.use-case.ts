import {
  NotFoundException,
  BusinessRuleException,
} from '@shared/exceptions/domain.exceptions';
import { IServiceOrderRepository } from '@domain/repositories/service-order.repository.interface';
import { ServiceOrderResponseDto } from '@application/dtos/response/service-order.dto';
import { AddServiceRequestDto } from '@application/dtos/request/service-order.dto';
import { Injectable, Logger } from '@nestjs/common';
import { IServiceRepository } from '@domain/repositories/service.repository.interface';
import { ServiceOrderMapper } from '@application/mappers/service-order.mapper';

@Injectable()
export class AddServiceToOrderUseCase {
  constructor(
    private readonly orderRepository: IServiceOrderRepository,
    private readonly serviceRepository: IServiceRepository,
    private readonly logger: Logger,
  ) {}

  async execute(
    orderId: string,
    dto: AddServiceRequestDto,
  ): Promise<ServiceOrderResponseDto> {
    this.logger.log(
      `Adding service ${dto.serviceId} to service order: ${orderId}`,
    );

    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      this.logger.warn(`Service order not found with ID: ${orderId}`);
      throw new NotFoundException('ServiceOrder', orderId);
    }

    const service = await this.serviceRepository.findById(dto.serviceId);
    if (!service) {
      this.logger.warn(`Service not found with ID: ${dto.serviceId}`);
      throw new NotFoundException('Service', dto.serviceId);
    }
    if (!service.isActive) {
      this.logger.warn(`Attempt to add inactive service: ${dto.serviceId}`);
      throw new BusinessRuleException(
        `Service "${service.name}" is not active`,
      );
    }

    order.addService({
      serviceId: service.id,
      serviceName: service.name,
      price: service.price,
      quantity: dto.quantity ?? 1,
      notes: dto.notes,
    });

    const updated = await this.orderRepository.update(order);

    this.logger.log(
      `Service ${dto.serviceId} added successfully to service order: ${orderId}`,
    );

    const response: ServiceOrderResponseDto =
      ServiceOrderMapper.toResponse(updated);
    return response;
  }
}
