import {
  context,
  propagation,
  ROOT_CONTEXT,
  Span,
  SpanKind,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api';
import { OutgoingMessage } from '@domain/messaging/saga-message';

import type { ConsumeMessage } from 'amqplib';

export interface TraceCarrier {
  traceparent?: string;
  tracestate?: string;
}

const tracer = trace.getTracer('oficina.messaging');

/**
 * Span de publicação filho do contexto gravado no outbox, e não do contexto
 * ativo: o relay publica fora da requisição que gerou a mensagem.
 */
export function tracedPublish<T>(
  message: OutgoingMessage,
  carrier: TraceCarrier,
  publish: (headers: Record<string, string>) => Promise<T>,
): Promise<T> {
  const parent = propagation.extract(ROOT_CONTEXT, carrier);
  const { envelope } = message;
  const span = tracer.startSpan(
    `${message.routingKey} publish`,
    {
      kind: SpanKind.PRODUCER,
      attributes: {
        'messaging.system': 'rabbitmq',
        'messaging.operation.type': 'publish',
        'messaging.destination.name': message.exchange,
        'messaging.rabbitmq.destination.routing_key': message.routingKey,
        'messaging.message.id': envelope.messageId,
        'messaging.message.conversation_id': envelope.sagaId,
        'oficina.saga_id': envelope.sagaId,
        'oficina.order_id': envelope.orderId,
      },
    },
    parent,
  );
  const headers: Record<string, string> = {};
  propagation.inject(trace.setSpan(parent, span), headers);
  return endWhenDone(span, () => publish(headers));
}

/** Span de consumo filho do span de publicação que veio no cabeçalho. */
export function tracedConsume<T>(
  queue: string,
  msg: ConsumeMessage,
  handle: () => Promise<T>,
): Promise<T> {
  const parent = propagation.extract(
    ROOT_CONTEXT,
    msg.properties.headers ?? {},
  );
  const span = tracer.startSpan(
    `${queue} process`,
    {
      kind: SpanKind.CONSUMER,
      attributes: {
        'messaging.system': 'rabbitmq',
        'messaging.operation.type': 'process',
        'messaging.destination.name': queue,
        'messaging.rabbitmq.destination.routing_key': msg.fields.routingKey,
        'messaging.message.id': String(msg.properties.messageId ?? ''),
        'messaging.message.conversation_id': String(
          msg.properties.correlationId ?? '',
        ),
        'oficina.message.type': String(msg.properties.type ?? ''),
      },
    },
    parent,
  );
  return context.with(trace.setSpan(parent, span), () =>
    endWhenDone(span, handle),
  );
}

async function endWhenDone<T>(span: Span, run: () => Promise<T>): Promise<T> {
  try {
    const result = await run();
    if (typeof result === 'string')
      span.setAttribute('oficina.outcome', result);
    return result;
  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw error;
  } finally {
    span.end();
  }
}
