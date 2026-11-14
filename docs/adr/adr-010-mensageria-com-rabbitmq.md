# ADR-010 — Mensageria assíncrona com RabbitMQ

**Status:** Aceita · **Data:** 2026-11-14 · **Substitui:** [ADR-003](adr-003-comunicacao-sincrona-rest.md)

## Contexto

A [ADR-003](adr-003-comunicacao-sincrona-rest.md) escolheu REST síncrono para tudo e listou a condição para ser revista: *"Se aparecer um segundo serviço que precise reagir a mudanças de ordem de serviço"*. Com a divisão em três serviços ([ADR-009](adr-009-divisao-em-microsservicos.md)), essa condição foi atingida. O Billing precisa saber quando uma OS aguarda orçamento, o Execution precisa saber quando ela foi paga, e o OS precisa saber de ambos.

O fluxo atravessa etapas que levam de minutos a dias: o cliente decide quando aprovar e quando pagar. Uma cadeia de chamadas síncronas não sobrevive a isso, e qualquer serviço fora do ar em uma etapa perderia o passo.

## Decisão

**RabbitMQ** para toda comunicação entre serviços. **REST** continua sendo a interface externa de cada serviço, atrás do API Gateway.

| Comunicação | Meio |
|---|---|
| Cliente/equipe → serviço | REST (JSON), via API Gateway + Traefik ([ADR-015](adr-015-traefik-como-ingress.md)) |
| Mercado Pago → Billing | Webhook HTTP |
| Serviço → serviço | Mensagens no RabbitMQ (comandos e eventos da saga) |

O broker roda dentro do cluster k3s (namespace `messaging`), como `StatefulSet` com volume persistente. A topologia, o envelope e o catálogo de mensagens estão em [contratos-de-mensagens.md](../arquitetura/contratos-de-mensagens.md).

### Três garantias que acompanham a decisão

1. **Transactional Outbox.** Nenhum serviço publica direto no broker de dentro de um caso de uso. A mudança de estado e a mensagem a publicar são gravadas **na mesma transação** do banco do serviço. Um *relay* lê as pendentes e publica com *publisher confirms*. Se o broker estiver fora, a mensagem espera no banco; se o serviço cair entre gravar e publicar, o relay publica quando ele voltar.
2. **Consumidor idempotente.** A entrega é *at-least-once*: o outbox pode publicar duas vezes e o broker pode reentregar. Todo consumidor registra o `messageId` processado na mesma transação do efeito e confirma sem reprocessar quando o recebe de novo.
3. **Retentativa com espera e DLQ.** Falha transitória volta para a fila após 5 s, 30 s e 2 min. Depois da terceira, a mensagem vai para a *dead letter queue* do consumidor, gera alerta ([observabilidade](../observabilidade.md)) e é reprocessada manualmente.

## Alternativas descartadas

**Amazon SQS + SNS.** Gerenciado e sem consumo de memória no nó. Descartado porque a decisão do projeto foi manter toda a infraestrutura de execução dentro do cluster, porque o painel do RabbitMQ torna filas, DLQs e mensagens visíveis na demonstração, e porque roteamento por *routing key* com *topic exchange* é nativo no RabbitMQ e exigiria um tópico SNS por tipo de evento.

**Kafka.** Resolve um problema que não temos: log de eventos retido para *replay* e alto volume. Exige muito mais memória do que o nó único comporta ([ADR-001](adr-001-k3s-em-ec2-no-lugar-do-eks.md)).

**gRPC entre serviços.** Considerado para chamadas síncronas internas. Descartado porque **não há chamada síncrona entre serviços nesse desenho**: tudo de que o Billing e o Execution precisam (itens, valores, contato do cliente) viaja no payload do comando da saga. Usar gRPC para a saga teria a mesma fragilidade do REST (o passo falha se o destino estiver fora) e obrigaria a reconstruir à mão a durabilidade e a retentativa que a fila entrega. Seria uma tecnologia sem problema para resolver, com `.proto` compartilhado entre três repositórios.

## Consequências

**Positivas**
- **Um serviço fora do ar não perde passos.** A mensagem espera na fila e o fluxo continua quando o serviço volta.
- **Publicar e consumir são desacoplados no tempo.** O OS responde ao usuário assim que grava a mudança, sem esperar o Billing.
- O ponto de extensão que a ADR-003 previa ("os casos de uso de transição são exatamente onde um evento de domínio seria publicado") vira realidade, via outbox.
- O trace distribuído atravessa o broker: a auto-instrumentação do OpenTelemetry propaga o `traceparent` nos headers das mensagens ([ADR-007](adr-007-opentelemetry-no-lugar-de-agente-proprietario.md)).

**Negativas**
- **Consistência eventual.** Há uma janela em que a OS está `AWAITING_APPROVAL` e o orçamento ainda não existe no Billing.
- **Mais um componente com estado para operar**: volume, credenciais, memória (~256–512 MiB) e um ponto único de falha, já que o broker roda com uma réplica num nó único.
- **Depurar fica mais difícil.** Um fluxo deixa de ser uma pilha de chamadas e vira uma sequência de mensagens. Mitigado pelo trace distribuído e pelo `sagaId` em toda linha de log.
- **O outbox quebra o contexto do trace** se nada for feito, porque o relay publica fora da requisição original. Cada mensagem guarda o `traceparent` de quando foi gravada, e o relay publica dentro desse contexto.
- Mensagens podem chegar fora de ordem depois de uma retentativa. A regra para lidar com isso está no contrato.
