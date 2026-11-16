/**
 * Único lugar que lê as variáveis da mensageria.
 *
 * Sem `RABBITMQ_URL` a mensageria fica desligada: a API sobe normalmente, o
 * relay não publica (as mensagens esperam no outbox) e o consumidor não
 * conecta. É o modo dos testes unitários/E2E e do desenvolvimento local sem
 * broker. Em produção a URL vem do Secret do Kubernetes.
 */
export const rabbitmqConfig = () => {
  const url = process.env.RABBITMQ_URL || '';
  return {
    rabbitmq: {
      url,
      enabled: url.length > 0,
      /** Mensagens entregues ao consumidor antes de ele confirmar as anteriores. */
      prefetch: Number(process.env.RABBITMQ_PREFETCH || 10),
      /** Limite de cada tentativa de conexão (ver RabbitMqConnection). */
      connectTimeoutMs: Number(
        process.env.RABBITMQ_CONNECT_TIMEOUT_MS || 5_000,
      ),
      /** Tempo máximo esperando a confirmação do broker em cada publicação. */
      publishTimeoutMs: Number(
        process.env.RABBITMQ_PUBLISH_TIMEOUT_MS || 5_000,
      ),
      /** Intervalo do relay do outbox. */
      relayIntervalMs: Number(process.env.OUTBOX_RELAY_INTERVAL_MS || 1_000),
      /** Mensagens publicadas por rodada do relay. */
      relayBatchSize: Number(process.env.OUTBOX_RELAY_BATCH_SIZE || 50),
    },
  };
};
