import {
  ISagaRepository,
  SagaLogOutcome,
} from '@domain/repositories/saga.repository.interface';
import { IEmailNotificationService } from '@domain/services/email-notification.service.interface';
import { IServiceOrderRepository } from '@domain/repositories/service-order.repository.interface';
import { ITransactionManager } from '@domain/services/transaction-manager.interface';
import {
  budgetCreatePayload,
  toOutgoingMessage,
} from '@application/saga/saga-commands';
import { ServiceOrderResponseDto } from '@application/dtos/response/service-order.dto';
import { ServiceOrderMetrics } from '@infrastructure/observability/service-order.metrics';
import { SagaInstanceEntity } from '@domain/entities/saga/saga-instance.entity';
import { ServiceOrderMapper } from '@application/mappers/service-order.mapper';
import { NotFoundException } from '@shared/exceptions/domain.exceptions';
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

/**
 * Pedido de aprovação: é aqui que a saga começa (ADR-011, passo 1). Na mesma
 * transação, a OS vai para AWAITING_APPROVAL, a saga é criada e o comando
 * `billing.budget.create` é gravado no outbox. O resto do fluxo acontece pelos
 * eventos do Billing e do Execution (ProcessSagaEventUseCase).
 */
@Injectable()
export class RequestApprovalUseCase {
  constructor(
    private readonly orderRepository: IServiceOrderRepository,
    private readonly sagaRepository: ISagaRepository,
    private readonly transactions: ITransactionManager,
    private readonly emailService: IEmailNotificationService,
    private readonly metrics: ServiceOrderMetrics,
    private readonly logger: Logger,
  ) {}

  async execute(id: string): Promise<ServiceOrderResponseDto> {
    this.logger.log(`Requesting approval for service order: ${id}`);

    const updated = await this.transactions.run(async () => {
      const order = await this.orderRepository.findById(id);
      if (!order) {
        this.logger.warn(`Service order not found with ID: ${id}`);
        throw new NotFoundException('ServiceOrder', id);
      }

      // Lidos antes da transição: `order` é mutado por `requestApproval()`,
      // e depois disso o status anterior não existe mais.
      const previousStatus = order.status;
      const previousStatusSince = order.updatedAt;

      order.requestApproval();

      const saga = SagaInstanceEntity.start(order.id, randomUUID());
      const command = toOutgoingMessage({
        type: 'billing.budget.create',
        payload: budgetCreatePayload(order),
        sagaId: saga.id,
        orderId: order.id,
        messageId: randomUUID(),
        now: new Date(),
      });

      const saved = await this.orderRepository.update(order, [command]);
      await this.sagaRepository.create(saga);
      await this.sagaRepository.appendLog({
        sagaId: saga.id,
        step: saga.step,
        eventType: 'billing.budget.create',
        messageId: command.envelope.messageId,
        outcome: SagaLogOutcome.STARTED,
      });

      this.transactions.afterCommit(async () => {
        this.metrics.recordTransition({
          fromStatus: previousStatus,
          toStatus: saved.status,
          since: previousStatusSince,
        });
        // Nome e e-mail gravados na OS na abertura (ADR-008/ADR-011): sem
        // consulta à tabela de clientes.
        await this.emailService.sendServiceOrderStatusUpdate({
          to: saved.customerEmail,
          customerName: saved.customerName,
          orderNumber: saved.orderNumber,
          status: saved.status,
        });
      });

      this.logger.log(
        `Service order ${id} transitioned to AWAITING_APPROVAL, saga ${saga.id} started`,
      );
      return saved;
    });

    const response: ServiceOrderResponseDto =
      ServiceOrderMapper.toResponse(updated);
    return response;
  }
}
