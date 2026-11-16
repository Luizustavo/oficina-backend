import { ServiceOrderSagaResponseDto } from '@application/dtos/response/saga.dto';
import { ISagaRepository } from '@domain/repositories/saga.repository.interface';
import { NotFoundException } from '@shared/exceptions/domain.exceptions';
import { SagaMapper } from '@application/mappers/saga.mapper';
import { Injectable, Logger } from '@nestjs/common';

/**
 * Saga atual de uma OS, com o histórico de eventos (PLANO-FASE-4, 7.6):
 * em que passo está, qual prazo corre, o último erro e tudo o que aconteceu.
 */
@Injectable()
export class GetServiceOrderSagaUseCase {
  constructor(
    private readonly sagaRepository: ISagaRepository,
    private readonly logger: Logger,
  ) {}

  async execute(orderId: string): Promise<ServiceOrderSagaResponseDto> {
    this.logger.log(`Fetching saga of service order: ${orderId}`);

    const saga = await this.sagaRepository.findCurrentByOrderId(orderId);
    if (!saga) {
      this.logger.warn(`No saga found for service order: ${orderId}`);
      throw new NotFoundException('Saga of ServiceOrder', orderId);
    }
    const logs = await this.sagaRepository.findLogs(saga.id);

    this.logger.log(`Saga ${saga.id} of service order ${orderId} found`);

    const response: ServiceOrderSagaResponseDto = SagaMapper.toResponse(
      saga,
      logs,
    );
    return response;
  }
}
