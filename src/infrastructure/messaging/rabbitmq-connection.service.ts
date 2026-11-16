import {
  AmqpConnectionManager,
  ChannelWrapper,
  CreateChannelOpts,
  connect,
} from 'amqp-connection-manager';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { rabbitmqConfig } from '@infrastructure/config/rabbitmq.config';

/**
 * Conexão única com o RabbitMQ, compartilhada pelo publicador e pelo
 * consumidor. O amqp-connection-manager reconecta sozinho quando o broker cai
 * e roda de novo o `setup` de cada canal (declaração da topologia, consumo).
 *
 * Com a mensageria desligada (sem RABBITMQ_URL), não conecta em nada.
 */
@Injectable()
export class RabbitMqConnection implements OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqConnection.name);
  private readonly config = rabbitmqConfig().rabbitmq;
  private manager?: AmqpConnectionManager;
  private failedAttempts = 0;

  get enabled(): boolean {
    return this.config.enabled;
  }

  createChannel(options: CreateChannelOpts): ChannelWrapper {
    return this.getManager().createChannel(options);
  }

  private getManager(): AmqpConnectionManager {
    if (!this.config.enabled) {
      throw new Error('Messaging is disabled: RABBITMQ_URL is not set');
    }
    if (!this.manager) {
      this.manager = connect([this.config.url], {
        heartbeatIntervalInSeconds: 30,
        reconnectTimeInSeconds: 5,
        // Limite de cada tentativa de conexão. Sem ele, enquanto o pod do
        // RabbitMQ está fora, o Service do Kubernetes fica sem destino e
        // descarta os pacotes em silêncio (não recusa a conexão): a tentativa
        // fica presa até o TCP desistir sozinho, uns 2 minutos. Medido no
        // cluster em 2026-11-16: 2 min 26 s para reconectar sem o limite.
        connectionOptions: { timeout: this.config.connectTimeoutMs },
      });
      const target = redact(this.config.url);
      this.manager.on('connect', () => {
        this.failedAttempts = 0;
        this.logger.log(`Connected to RabbitMQ at ${target}`);
      });
      this.manager.on('disconnect', ({ err }) =>
        this.logger.warn(
          `Disconnected from RabbitMQ at ${target}: ${err?.message ?? 'unknown reason'}. Reconnecting...`,
        ),
      );
      this.manager.on('connectFailed', ({ err }) => {
        // Uma linha na primeira falha e depois a cada minuto, para o log não
        // virar uma tentativa a cada 5 s enquanto o broker estiver fora.
        this.failedAttempts++;
        if (this.failedAttempts === 1 || this.failedAttempts % 12 === 0) {
          this.logger.warn(
            `Could not connect to RabbitMQ at ${target} (attempt ${this.failedAttempts}): ${err?.message ?? 'unknown reason'}`,
          );
        }
      });
    }
    return this.manager;
  }

  async onModuleDestroy(): Promise<void> {
    await this.manager?.close();
  }
}

/** URL sem usuário e senha, para log. */
function redact(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return '(invalid RABBITMQ_URL)';
  }
}
