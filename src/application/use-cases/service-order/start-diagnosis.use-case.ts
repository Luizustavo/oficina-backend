import { Injectable, Logger } from '@nestjs/common';
import { IServiceOrderRepository } from '@domain/repositories/service-order.repository.interface';
import { NotFoundException } from '@shared/exceptions/domain.exceptions';
import { ServiceOrderResponseDto } from '@application/dtos/response/service-order.dto';
import { ServiceOrderMapper } from '@application/mappers/service-order.mapper';

@Injectable()
export class StartDiagnosisUseCase {
  constructor(
    private readonly orderRepository: IServiceOrderRepository,
    private readonly logger: Logger,
  ) {}

  async execute(id: string): Promise<ServiceOrderResponseDto> {
    this.logger.log(`Starting diagnosis for service order: ${id}`);

    const order = await this.orderRepository.findById(id);
    if (!order) {
      this.logger.warn(`Service order not found with ID: ${id}`);
      throw new NotFoundException('ServiceOrder', id);
    }

    order.startDiagnosis();
    const updated = await this.orderRepository.update(order);

    this.logger.log(`Service order ${id} transitioned to IN_DIAGNOSIS`);

    const response: ServiceOrderResponseDto =
      ServiceOrderMapper.toResponse(updated);
    return response;
  }
}
