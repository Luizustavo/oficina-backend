import {
  deadLetterQueueName,
  retryQueueName,
  RETRY_DELAYS_MS,
} from '@domain/messaging/retry-policy';
import { SagaExchange } from '@domain/messaging/saga-message';

import type { Channel } from 'amqplib';

/**
 * Topologia do RabbitMQ do lado do OS Service
 * (docs/arquitetura/contratos-de-mensagens.md, seção 3). As declarações são
 * idempotentes: rodam a cada (re)conexão e não mudam nada se já existir.
 * Argumentos diferentes dos já existentes derrubam o canal
 * (PRECONDITION_FAILED), por isso eles são iguais nos três serviços.
 */

/** Fila de eventos da saga consumida pelo OS Service (o orquestrador). */
export const OS_SAGA_EVENTS_QUEUE = 'os.saga-events';

/** Eventos que o orquestrador escuta: tudo o que o Billing e o Execution publicam. */
const OS_SAGA_EVENTS_BINDINGS = ['billing.#', 'execution.#'];

export async function assertExchanges(channel: Channel): Promise<void> {
  await channel.assertExchange(SagaExchange.COMMANDS, 'topic', {
    durable: true,
  });
  await channel.assertExchange(SagaExchange.EVENTS, 'topic', {
    durable: true,
  });
  await channel.assertExchange(SagaExchange.DEAD_LETTER, 'direct', {
    durable: true,
  });
}

/**
 * Declara uma fila de consumo com as três filas de espera da retentativa e a
 * DLQ. Igual para qualquer serviço: muda só o nome, a exchange e os bindings.
 */
export async function assertConsumerQueue(
  channel: Channel,
  queue: string,
  exchange: string,
  bindingKeys: string[],
): Promise<void> {
  await channel.assertQueue(queue, {
    durable: true,
    arguments: {
      'x-queue-type': 'quorum',
      // nack sem requeue (mensagem inválida) cai na DLQ por aqui.
      'x-dead-letter-exchange': SagaExchange.DEAD_LETTER,
      'x-dead-letter-routing-key': queue,
    },
  });
  for (const key of bindingKeys) {
    await channel.bindQueue(queue, exchange, key);
  }

  // Filas de espera: ninguém consome. Quando o TTL vence, a mensagem volta
  // direto para a fila de origem pela exchange padrão (""), sem passar de
  // novo pela exchange da saga nem chegar a outros consumidores.
  for (const [index, ttl] of RETRY_DELAYS_MS.entries()) {
    await channel.assertQueue(retryQueueName(queue, index + 1), {
      durable: true,
      arguments: {
        'x-queue-type': 'quorum',
        'x-message-ttl': ttl,
        'x-dead-letter-exchange': '',
        'x-dead-letter-routing-key': queue,
      },
    });
  }

  const dlq = deadLetterQueueName(queue);
  await channel.assertQueue(dlq, {
    durable: true,
    arguments: { 'x-queue-type': 'quorum' },
  });
  await channel.bindQueue(dlq, SagaExchange.DEAD_LETTER, queue);
}

/** Tudo o que o OS Service declara ao conectar. */
export async function assertOsTopology(channel: Channel): Promise<void> {
  await assertExchanges(channel);
  await assertConsumerQueue(
    channel,
    OS_SAGA_EVENTS_QUEUE,
    SagaExchange.EVENTS,
    OS_SAGA_EVENTS_BINDINGS,
  );
}
