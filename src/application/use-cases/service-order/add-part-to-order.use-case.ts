import { Injectable, Logger } from '@nestjs/common';
import { IServiceOrderRepository } from '@domain/repositories/service-order.repository.interface';
import { IPartRepository } from '@domain/repositories/part.repository.interface';
import {
  NotFoundException,
  InsufficientStockException,
  BusinessRuleException,
} from '@shared/exceptions/domain.exceptions';
import { AddPartRequestDto } from '@application/dtos/request/service-order.dto';
import { ServiceOrderResponseDto } from '@application/dtos/response/service-order.dto';
import { ServiceOrderMapper } from '@application/mappers/service-order.mapper';

@Injectable()
export class AddPartToOrderUseCase {
  constructor(
    private readonly orderRepository: IServiceOrderRepository,
    private readonly partRepository: IPartRepository,
    private readonly logger: Logger,
  ) {}

  async execute(
    orderId: string,
    dto: AddPartRequestDto,
  ): Promise<ServiceOrderResponseDto> {
    this.logger.log(`Adding part ${dto.partId} to service order: ${orderId}`);

    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      this.logger.warn(`Service order not found with ID: ${orderId}`);
      throw new NotFoundException('ServiceOrder', orderId);
    }

    const part = await this.partRepository.findById(dto.partId);
    if (!part) {
      this.logger.warn(`Part not found with ID: ${dto.partId}`);
      throw new NotFoundException('Part', dto.partId);
    }
    if (!part.isActive) {
      this.logger.warn(`Attempt to add inactive part: ${dto.partId}`);
      throw new BusinessRuleException(`Part "${part.name}" is not active`);
    }
    if (!part.hasEnoughStock(dto.quantity)) {
      this.logger.warn(
        `Insufficient stock for part ${dto.partId} - requested: ${dto.quantity}, available: ${part.stockQuantity}`,
      );
      throw new InsufficientStockException(
        part.name,
        dto.quantity,
        part.stockQuantity,
      );
    }

    order.addPart({
      partId: part.id,
      partName: part.name,
      partCode: part.code,
      unitPrice: part.price,
      quantity: dto.quantity,
      totalPrice: Math.round(part.price * dto.quantity * 100) / 100,
    });

    part.decrementStock(dto.quantity);

    await this.partRepository.update(part);
    const updated = await this.orderRepository.update(order);

    this.logger.log(
      `Part ${dto.partId} added successfully to service order: ${orderId}`,
    );

    const response: ServiceOrderResponseDto =
      ServiceOrderMapper.toResponse(updated);
    return response;
  }
}
