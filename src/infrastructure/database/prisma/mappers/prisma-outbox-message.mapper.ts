import { OutgoingMessage } from '@domain/messaging/saga-message';
import { context, propagation } from '@opentelemetry/api';
import { Prisma } from '@generated/prisma/client';

export class PrismaOutboxMessageMapper {
  private constructor() {
    throw new Error(
      'PrismaOutboxMessageMapper is a static class and cannot be instantiated.',
    );
  }

  /**
   * Linha do outbox para uma mensagem. O contexto do trace é capturado aqui,
   * na gravação, e não na publicação: assim o trace liga a requisição que
   * mudou o estado ao consumidor do outro serviço, mesmo que o relay publique
   * segundos depois (contratos-de-mensagens.md, propriedades AMQP).
   */
  public static toPrisma(
    message: OutgoingMessage,
  ): Prisma.OutboxMessageCreateManyInput {
    const carrier: Record<string, string> = {};
    propagation.inject(context.active(), carrier);
    return {
      id: message.envelope.messageId,
      exchange: message.exchange,
      routingKey: message.routingKey,
      payload: message.envelope as unknown as Prisma.InputJsonValue,
      traceparent: carrier.traceparent ?? null,
      tracestate: carrier.tracestate ?? null,
    };
  }
}
