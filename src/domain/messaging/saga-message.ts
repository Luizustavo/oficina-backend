import { InvalidMessageException } from '@shared/exceptions/domain.exceptions';

/**
 * Formato das mensagens da saga entre OS, Billing e Execution. A fonte da
 * verdade é docs/arquitetura/contratos-de-mensagens.md (seção 2): este
 * arquivo só traduz o contrato para tipos.
 */
export interface SagaEnvelope<P = Record<string, unknown>> {
  /** Chave de idempotência. Mantida em reentregas e republicações. */
  messageId: string;
  sagaId: string;
  /** Id da OS no OS Service, presente em toda mensagem. */
  orderId: string;
  /** Igual à routing key: `billing.budget.create`, `execution.job.started`... */
  type: string;
  /** Versão do formato do payload (seção 7 do contrato). */
  version: number;
  /** ISO-8601 em UTC. */
  occurredAt: string;
  payload: P;
}

export const SagaExchange = {
  /** Comandos do orquestrador (OS) para Billing e Execution. */
  COMMANDS: 'saga.commands',
  /** Eventos publicados pelo Billing e pelo Execution. */
  EVENTS: 'saga.events',
  /** Falha definitiva: leva a mensagem para a `<fila>.dlq`. */
  DEAD_LETTER: 'saga.dlx',
} as const;

/** Mensagem pronta para ir ao outbox: para onde vai e o que leva. */
export interface OutgoingMessage {
  exchange: string;
  routingKey: string;
  envelope: SagaEnvelope;
}

/**
 * Monta um comando do orquestrador. `messageId` e `occurredAt` vêm de fora
 * (UUID e relógio) para a função continuar pura e testável.
 */
export function buildSagaCommand(params: {
  messageId: string;
  sagaId: string;
  orderId: string;
  type: string;
  version?: number;
  occurredAt: Date;
  payload: Record<string, unknown>;
}): OutgoingMessage {
  return {
    exchange: SagaExchange.COMMANDS,
    routingKey: params.type,
    envelope: {
      messageId: params.messageId,
      sagaId: params.sagaId,
      orderId: params.orderId,
      type: params.type,
      version: params.version ?? 1,
      occurredAt: params.occurredAt.toISOString(),
      payload: params.payload,
    },
  };
}

const REQUIRED_STRINGS = [
  'messageId',
  'sagaId',
  'orderId',
  'type',
  'occurredAt',
] as const;

/**
 * Valida o corpo de uma mensagem recebida. Qualquer problema vira
 * InvalidMessageException, que o consumidor manda direto para a DLQ: uma
 * mensagem malformada não melhora com retentativa.
 */
export function parseSagaEnvelope(body: string): SagaEnvelope {
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    throw new InvalidMessageException('Message body is not valid JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new InvalidMessageException('Message body is not a JSON object');
  }

  const candidate = raw as Record<string, unknown>;
  for (const field of REQUIRED_STRINGS) {
    const value = candidate[field];
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new InvalidMessageException(`Envelope field "${field}" is missing`);
    }
  }
  if (!Number.isInteger(candidate.version) || Number(candidate.version) < 1) {
    throw new InvalidMessageException('Envelope field "version" is invalid');
  }
  const payload = candidate.payload;
  if (
    typeof payload !== 'object' ||
    payload === null ||
    Array.isArray(payload)
  ) {
    throw new InvalidMessageException('Envelope field "payload" is missing');
  }

  return candidate as unknown as SagaEnvelope;
}
