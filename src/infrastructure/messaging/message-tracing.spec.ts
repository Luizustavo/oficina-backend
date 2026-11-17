import { context, propagation, SpanKind, trace } from '@opentelemetry/api';
import { tracedConsume, tracedPublish, TraceCarrier } from './message-tracing';
import { OutgoingMessage } from '@domain/messaging/saga-message';
import { node, tracing } from '@opentelemetry/sdk-node';

import type { ConsumeMessage } from 'amqplib';

const message: OutgoingMessage = {
  exchange: 'saga.events',
  routingKey: 'billing.budget.created',
  envelope: {
    messageId: 'message-1',
    sagaId: 'saga-1',
    orderId: 'order-1',
    type: 'billing.budget.created',
    version: 1,
    occurredAt: '2026-11-17T10:00:00.000Z',
    payload: {},
  },
};

const delivery = (headers: Record<string, string>): ConsumeMessage =>
  ({
    content: Buffer.from('{}'),
    fields: { routingKey: message.routingKey },
    properties: {
      headers,
      messageId: 'message-1',
      correlationId: 'saga-1',
      type: 'billing.budget.created',
    },
  }) as unknown as ConsumeMessage;

describe('message tracing', () => {
  const exporter = new tracing.InMemorySpanExporter();
  const provider = new node.NodeTracerProvider({
    spanProcessors: [new tracing.SimpleSpanProcessor(exporter)],
  });

  beforeAll(() => provider.register());
  afterEach(() => exporter.reset());
  afterAll(async () => {
    await provider.shutdown();
    trace.disable();
    context.disable();
    propagation.disable();
  });

  const carrierOfNewRequest = (): {
    carrier: TraceCarrier;
    traceId: string;
  } => {
    const request = trace.getTracer('test').startSpan('POST /request-approval');
    const carrier: TraceCarrier = {};
    propagation.inject(trace.setSpan(context.active(), request), carrier);
    request.end();
    return { carrier, traceId: request.spanContext().traceId };
  };

  it('keeps request, publish and consume in one trace', async () => {
    const { carrier, traceId } = carrierOfNewRequest();
    let headers: Record<string, string> = {};
    let activeInHandler: string | undefined;

    await tracedPublish(message, carrier, (sent) => {
      headers = sent;
      return Promise.resolve();
    });
    await tracedConsume('os.saga-events', delivery(headers), () => {
      activeInHandler = trace.getActiveSpan()?.spanContext().traceId;
      return Promise.resolve('processed');
    });

    const [request, publish, consume] = exporter.getFinishedSpans();
    expect(publish.kind).toBe(SpanKind.PRODUCER);
    expect(consume.kind).toBe(SpanKind.CONSUMER);
    expect(
      new Set([request, publish, consume].map((s) => s.spanContext().traceId)),
    ).toEqual(new Set([traceId]));
    expect(publish.parentSpanContext?.spanId).toBe(
      request.spanContext().spanId,
    );
    expect(consume.parentSpanContext?.spanId).toBe(
      publish.spanContext().spanId,
    );
    expect(activeInHandler).toBe(traceId);
    expect(consume.attributes['oficina.outcome']).toBe('processed');
    expect(publish.attributes['oficina.saga_id']).toBe('saga-1');
  });

  it('starts a new trace when the outbox row has no trace context', async () => {
    await tracedPublish(message, {}, () => Promise.resolve());

    const [publish] = exporter.getFinishedSpans();
    expect(publish.parentSpanContext).toBeUndefined();
  });

  it('marks the span as failed and rethrows', async () => {
    await expect(
      tracedConsume('os.saga-events', delivery({}), () =>
        Promise.reject(new Error('database down')),
      ),
    ).rejects.toThrow('database down');

    const [consume] = exporter.getFinishedSpans();
    expect(consume.status.code).toBe(2);
    expect(consume.events[0].name).toBe('exception');
  });
});
