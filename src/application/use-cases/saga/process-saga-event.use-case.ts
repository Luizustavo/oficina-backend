import {
  InvalidMessageException,
  SagaEventOutOfOrderException,
} from '@shared/exceptions/domain.exceptions';
import {
  ISagaRepository,
  SagaLogOutcome,
} from '@domain/repositories/saga.repository.interface';
import {
  decideSagaTransition,
  DeadlineChange,
  SagaDecision,
  SagaEvent,
} from '@application/saga/service-order-saga';
import { IEmailNotificationService } from '@domain/services/email-notification.service.interface';
import { IServiceOrderRepository } from '@domain/repositories/service-order.repository.interface';
import { ITransactionManager } from '@domain/services/transaction-manager.interface';
import {
  commandPayload,
  toOutgoingMessage,
} from '@application/saga/saga-commands';
import { ServiceOrderEntity } from '@domain/entities/service-order/service-order.entity';
import { ServiceOrderMetrics } from '@infrastructure/observability/service-order.metrics';
import { SagaInstanceEntity } from '@domain/entities/saga/saga-instance.entity';
import { IPartRepository } from '@domain/repositories/part.repository.interface';
import { SagaSettings } from '@application/saga/saga-settings';
import { PartEntity } from '@domain/entities/part/part.entity';
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

export interface SagaEventInput {
  type: string;
  orderId: string;
  /** Ausente nos eventos internos (cancelamento manual, prazo vencido). */
  sagaId?: string;
  messageId?: string;
  /** Motivo da falha, quando o evento traz um. */
  detail?: string;
}

export interface SagaEventResult {
  outcome: 'applied' | 'ignored';
  order?: ServiceOrderEntity;
}

/**
 * Executa a decisão do orquestrador (application/saga/service-order-saga.ts)
 * para um evento da saga, numa única transação (ADR-011, "Uma transação por
 * evento"): avança a saga e grava o histórico, muda a OS e o estoque e grava
 * no outbox os comandos seguintes. Ou tudo, ou nada.
 *
 * Chamado pelo consumidor da fila `os.saga-events`, pelo cancelamento manual
 * da equipe e pela varredura de prazos.
 */
@Injectable()
export class ProcessSagaEventUseCase {
  constructor(
    private readonly orderRepository: IServiceOrderRepository,
    private readonly sagaRepository: ISagaRepository,
    private readonly partRepository: IPartRepository,
    private readonly transactions: ITransactionManager,
    private readonly emailService: IEmailNotificationService,
    private readonly settings: SagaSettings,
    private readonly metrics: ServiceOrderMetrics,
    private readonly logger: Logger,
  ) {}

  async execute(event: SagaEventInput): Promise<SagaEventResult> {
    this.logger.log(
      `Processing saga event ${event.type} for order ${event.orderId}`,
    );

    return this.transactions.run(async () => {
      // Travada até o fim da transação: eventos simultâneos da mesma saga
      // são aplicados um de cada vez.
      const saga = await this.sagaRepository.lockCurrentByOrderId(
        event.orderId,
      );
      if (!saga) {
        this.logger.warn(`No saga found for order ${event.orderId}`);
        // Nunca vai dar certo: vai para a DLQ, sem retentativa.
        throw new InvalidMessageException(
          `No saga found for order ${event.orderId}`,
        );
      }

      // Evento de uma tentativa anterior (a OS voltou ao diagnóstico e abriu
      // outra saga): é de um passo já superado.
      if (event.sagaId && event.sagaId !== saga.id) {
        await this.log(saga, event, SagaLogOutcome.IGNORED_STALE, 'old saga');
        return { outcome: 'ignored' };
      }

      let decision = decideSagaTransition(saga, event.type, event.detail);

      if (decision.outcome === 'retry-later') {
        this.logger.warn(
          `Saga ${saga.id} received ${event.type} out of order: ${decision.reason}`,
        );
        throw new SagaEventOutOfOrderException(decision.reason);
      }

      if (decision.outcome === 'ignore') {
        const finished = decision.reason === 'finished';
        if (finished) {
          this.logger.warn(
            `Saga ${saga.id} is ${saga.status}: ${event.type} acknowledged without effect`,
          );
        }
        await this.log(
          saga,
          event,
          finished
            ? SagaLogOutcome.IGNORED_FINISHED
            : SagaLogOutcome.IGNORED_STALE,
        );
        return { outcome: 'ignored' };
      }

      const order = await this.orderRepository.findById(saga.orderId);
      if (!order) {
        this.logger.warn(`Order ${saga.orderId} of saga ${saga.id} not found`);
        throw new InvalidMessageException(`Order ${saga.orderId} not found`);
      }

      // Reserva de peças na aprovação. Sem estoque suficiente (outra OS
      // consumiu as peças entre o orçamento e a aprovação), a decisão passa a
      // ser a de "peças indisponíveis": cancelar o orçamento.
      let parts: PartEntity[] = [];
      if (decision.stock === 'reserve') {
        const reserved = await this.adjustStock(order, 'reserve');
        if (reserved) {
          parts = reserved;
        } else {
          this.logger.warn(
            `Not enough stock to reserve parts of order ${order.id}, canceling the budget`,
          );
          decision = decideSagaTransition(saga, SagaEvent.PARTS_UNAVAILABLE);
        }
      } else if (decision.stock === 'release') {
        parts = (await this.adjustStock(order, 'release')) ?? [];
      }

      return this.apply(saga, order, event, decision, parts);
    });
  }

  private async apply(
    saga: SagaInstanceEntity,
    order: ServiceOrderEntity,
    event: SagaEventInput,
    decision: SagaDecision,
    parts: PartEntity[],
  ): Promise<SagaEventResult> {
    if (decision.outcome !== 'apply') {
      return { outcome: 'ignored' };
    }

    const previousStatus = order.status;
    const previousStatusSince = order.updatedAt;
    if (decision.orderAction) {
      order[decision.orderAction]();
    }

    const now = new Date();
    const messages = decision.commands.map((intent) =>
      toOutgoingMessage({
        type: intent.type,
        payload: commandPayload(intent, order),
        sagaId: saga.id,
        orderId: order.id,
        messageId: randomUUID(),
        now,
      }),
    );

    for (const part of parts) {
      await this.partRepository.update(part);
    }
    const updated = await this.orderRepository.update(order, messages);

    saga.moveTo({
      step: decision.step,
      status: decision.status,
      deadlineAt: this.deadline(decision.deadline, now),
      error: decision.error,
    });
    await this.sagaRepository.update(saga);
    await this.log(
      saga,
      event,
      SagaLogOutcome.APPLIED,
      decision.commands.map((c) => c.type).join(', ') || undefined,
    );

    if (decision.orderAction) {
      // Só depois do commit: se a transação for desfeita, o cliente não
      // recebe e-mail de uma mudança que não aconteceu.
      this.transactions.afterCommit(async () => {
        this.metrics.recordTransition({
          fromStatus: previousStatus,
          toStatus: updated.status,
          since: previousStatusSince,
        });
        await this.emailService.sendServiceOrderStatusUpdate({
          to: updated.customerEmail,
          customerName: updated.customerName,
          orderNumber: updated.orderNumber,
          status: updated.status,
        });
      });
    }

    this.logger.log(
      `Saga ${saga.id} moved to ${saga.status}/${saga.step} on ${event.type}, order ${order.id} is ${updated.status}`,
    );
    return { outcome: 'applied', order: updated };
  }

  /**
   * Baixa (reserve) ou devolve (release) as peças da OS. Na reserva, retorna
   * `null` se faltar estoque de alguma peça, sem alterar nenhuma.
   */
  private async adjustStock(
    order: ServiceOrderEntity,
    mode: 'reserve' | 'release',
  ): Promise<PartEntity[] | null> {
    // A mesma peça pode aparecer em mais de um item da OS.
    const quantities = new Map<string, number>();
    for (const item of order.parts) {
      quantities.set(
        item.partId,
        (quantities.get(item.partId) ?? 0) + item.quantity,
      );
    }

    const parts: PartEntity[] = [];
    for (const [partId, quantity] of quantities) {
      const part = await this.partRepository.findById(partId);
      if (!part) {
        if (mode === 'reserve') return null;
        // Peça apagada do catálogo depois da reserva: não há onde devolver.
        this.logger.warn(`Part ${partId} no longer exists, skipping release`);
        continue;
      }
      if (mode === 'reserve') {
        if (!part.hasEnoughStock(quantity)) return null;
        part.decrementStock(quantity);
      } else {
        part.addStock(quantity);
      }
      parts.push(part);
    }
    return parts;
  }

  private deadline(change: DeadlineChange, now: Date): Date | null | undefined {
    switch (change) {
      case 'approval':
        return new Date(now.getTime() + this.settings.approvalTimeoutMs);
      case 'payment':
        return new Date(now.getTime() + this.settings.paymentTimeoutMs);
      case 'clear':
        return null;
      case 'keep':
        return undefined;
    }
  }

  private log(
    saga: SagaInstanceEntity,
    event: SagaEventInput,
    outcome: SagaLogOutcome,
    detail?: string,
  ): Promise<void> {
    return this.sagaRepository.appendLog({
      sagaId: saga.id,
      step: saga.step,
      eventType: event.type,
      messageId: event.messageId,
      outcome,
      detail: detail ?? event.detail,
    });
  }
}
