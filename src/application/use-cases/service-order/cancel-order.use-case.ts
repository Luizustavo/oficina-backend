import { IEmailNotificationService } from '@domain/services/email-notification.service.interface';
import { IServiceOrderRepository } from '@domain/repositories/service-order.repository.interface';
import { ProcessSagaEventUseCase } from '@application/use-cases/saga/process-saga-event.use-case';
import { ServiceOrderResponseDto } from '@application/dtos/response/service-order.dto';
import { ISagaRepository } from '@domain/repositories/saga.repository.interface';
import { ServiceOrderMetrics } from '@infrastructure/observability/service-order.metrics';
import { ServiceOrderMapper } from '@application/mappers/service-order.mapper';
import { NotFoundException } from '@shared/exceptions/domain.exceptions';
import { SagaEvent } from '@application/saga/service-order-saga';
import { SagaStatus } from '@domain/enums/saga.enum';
import { Injectable, Logger } from '@nestjs/common';

/**
 * Cancelamento pela equipe. Com a saga em andamento, quem cancela é a saga
 * (ADR-011, "Cancelamento manual"): ela compensa o passo atual, ou seja,
 * cancela o orçamento, devolve as peças, tira o job da fila e pede o estorno,
 * conforme o caso. Sem saga em andamento (OS ainda no diagnóstico), cancela
 * direto.
 */
@Injectable()
export class CancelOrderUseCase {
  constructor(
    private readonly orderRepository: IServiceOrderRepository,
    private readonly sagaRepository: ISagaRepository,
    private readonly processSagaEvent: ProcessSagaEventUseCase,
    private readonly emailService: IEmailNotificationService,
    private readonly metrics: ServiceOrderMetrics,
    private readonly logger: Logger,
  ) {}

  async execute(id: string): Promise<ServiceOrderResponseDto> {
    this.logger.log(`Canceling service order: ${id}`);

    const order = await this.orderRepository.findById(id);
    if (!order) {
      this.logger.warn(`Service order not found with ID: ${id}`);
      throw new NotFoundException('ServiceOrder', id);
    }

    const saga = await this.sagaRepository.findCurrentByOrderId(id);
    if (saga?.status === SagaStatus.RUNNING) {
      const result = await this.processSagaEvent.execute({
        type: SagaEvent.MANUAL_CANCEL,
        orderId: id,
      });
      if (result.order) {
        this.logger.log(
          `Service order ${id} canceled through saga ${saga.id}, compensation started`,
        );
        const response: ServiceOrderResponseDto = ServiceOrderMapper.toResponse(
          result.order,
        );
        return response;
      }
    }

    // Lidos antes da transição: `order` é mutado por `cancel()`,
    // e depois disso o status anterior não existe mais.
    const previousStatus = order.status;
    const previousStatusSince = order.updatedAt;

    order.cancel();
    const updated = await this.orderRepository.update(order);

    this.metrics.recordTransition({
      fromStatus: previousStatus,
      toStatus: updated.status,
      since: previousStatusSince,
    });

    // Nome e e-mail gravados na OS na abertura (ADR-008/ADR-011): sem
    // consulta à tabela de clientes.
    await this.emailService.sendServiceOrderStatusUpdate({
      to: updated.customerEmail,
      customerName: updated.customerName,
      orderNumber: updated.orderNumber,
      status: updated.status,
    });

    this.logger.log(`Service order ${id} transitioned to CANCELED`);

    const response: ServiceOrderResponseDto =
      ServiceOrderMapper.toResponse(updated);
    return response;
  }
}
