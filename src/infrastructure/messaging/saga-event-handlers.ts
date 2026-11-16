import { ProcessSagaEventUseCase } from '@application/use-cases/saga/process-saga-event.use-case';
import { SagaMessageHandlerRegistry } from './saga-message-handler.registry';
import { BROKER_SAGA_EVENTS } from '@application/saga/service-order-saga';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { SagaEnvelope } from '@domain/messaging/saga-message';

/**
 * Liga cada evento da saga que chega pela fila `os.saga-events` ao
 * orquestrador. O consumidor (SagaEventsConsumer) já cuida da idempotência,
 * da transação e da retentativa; aqui só se traduz o envelope.
 */
@Injectable()
export class SagaEventHandlers implements OnModuleInit {
  constructor(
    private readonly registry: SagaMessageHandlerRegistry,
    private readonly processSagaEvent: ProcessSagaEventUseCase,
  ) {}

  onModuleInit(): void {
    for (const type of BROKER_SAGA_EVENTS) {
      this.registry.register({
        type,
        versions: [1],
        handle: async (envelope: SagaEnvelope) => {
          await this.processSagaEvent.execute({
            type: envelope.type,
            orderId: envelope.orderId,
            sagaId: envelope.sagaId,
            messageId: envelope.messageId,
            detail: failureDetail(envelope.payload),
          });
        },
      });
    }
  }
}

/** Motivo de uma falha, quando o evento traz (`detail` ou `reason`). */
function failureDetail(payload: Record<string, unknown>): string | undefined {
  const parts = [payload.reason, payload.detail].filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
  return parts.length > 0 ? parts.join(': ') : undefined;
}
