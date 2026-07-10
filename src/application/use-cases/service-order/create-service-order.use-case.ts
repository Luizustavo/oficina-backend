import {
  NotFoundException,
  BusinessRuleException,
} from '@shared/exceptions/domain.exceptions';
import { CreateServiceOrderRequestDto } from '@application/dtos/request/service-order.dto';
import { IServiceOrderRepository } from '@domain/repositories/service-order.repository.interface';
import { ServiceOrderResponseDto } from '@application/dtos/response/service-order.dto';
import { ICustomerRepository } from '@domain/repositories/customer.repository.interface';
import { Injectable, Logger } from '@nestjs/common';
import { IVehicleRepository } from '@domain/repositories/vehicle.repository.interface';
import { ServiceOrderEntity } from '@domain/entities/service-order/service-order.entity';
import { ServiceOrderMapper } from '@application/mappers/service-order.mapper';

function generateOrderNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const random = Math.floor(Math.random() * 999999)
    .toString()
    .padStart(6, '0');
  return `OS${year}${random}`;
}

@Injectable()
export class CreateServiceOrderUseCase {
  constructor(
    private readonly orderRepository: IServiceOrderRepository,
    private readonly customerRepository: ICustomerRepository,
    private readonly vehicleRepository: IVehicleRepository,
    private readonly logger: Logger,
  ) {}

  async execute(
    dto: CreateServiceOrderRequestDto,
  ): Promise<ServiceOrderResponseDto> {
    this.logger.log(
      `Creating service order for customer: ${dto.customerId}, vehicle: ${dto.vehicleId}`,
    );

    const customerExists = await this.customerRepository.existsById(
      dto.customerId,
    );
    if (!customerExists) {
      this.logger.warn(
        `Attempt to create service order for missing customer: ${dto.customerId}`,
      );
      throw new NotFoundException('Customer', dto.customerId);
    }

    const vehicle = await this.vehicleRepository.findById(dto.vehicleId);
    if (!vehicle) {
      this.logger.warn(
        `Attempt to create service order for missing vehicle: ${dto.vehicleId}`,
      );
      throw new NotFoundException('Vehicle', dto.vehicleId);
    }
    if (vehicle.customerId !== dto.customerId) {
      this.logger.warn(
        `Vehicle ${dto.vehicleId} does not belong to customer ${dto.customerId}`,
      );
      throw new BusinessRuleException(
        'Vehicle does not belong to the specified customer',
      );
    }

    const order = ServiceOrderEntity.create({
      orderNumber: generateOrderNumber(),
      customerId: dto.customerId,
      vehicleId: dto.vehicleId,
      problemDescription: dto.problemDescription,
      notes: dto.notes,
    });

    const created = await this.orderRepository.create(order);

    this.logger.log(
      `Service order created successfully with ID: ${created.id}, order number: ${created.orderNumber}`,
    );

    const response: ServiceOrderResponseDto =
      ServiceOrderMapper.toResponse(created);
    return response;
  }
}
