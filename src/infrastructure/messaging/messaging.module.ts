import { IMessagePublisher } from '@domain/services/message-publisher.interface';
import { SagaMessageHandlerRegistry } from './saga-message-handler.registry';
import { RabbitMqMessagePublisher } from './rabbitmq-message-publisher';
import { RabbitMqConnection } from './rabbitmq-connection.service';
import { OutboxRelayService } from './outbox-relay.service';
import { SagaEventsConsumer } from './saga-events.consumer';
import { Global, Module } from '@nestjs/common';

/**
 * Mensageria do OS Service (ADR-010, etapa 4.5 do plano): conexão com o
 * RabbitMQ, relay do outbox e consumidor dos eventos da saga.
 *
 * Global porque os módulos de negócio (a saga, no PR C) registram seus
 * tratadores no SagaMessageHandlerRegistry. Sem RABBITMQ_URL tudo continua
 * instanciado, mas nada conecta (rabbitmq.config.ts).
 */
@Global()
@Module({
  providers: [
    RabbitMqConnection,
    RabbitMqMessagePublisher,
    { provide: IMessagePublisher, useExisting: RabbitMqMessagePublisher },
    SagaMessageHandlerRegistry,
    OutboxRelayService,
    SagaEventsConsumer,
  ],
  exports: [IMessagePublisher, SagaMessageHandlerRegistry],
})
export class MessagingModule {}
