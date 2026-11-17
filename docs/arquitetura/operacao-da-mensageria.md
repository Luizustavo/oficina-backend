# Operação da mensageria e demonstração da saga

Guia prático para acompanhar as mensagens da saga no RabbitMQ, entender por que uma mensagem foi parar numa DLQ e reprocessá-la, e rodar os cenários S1 a S7 com o `scripts/demo-saga.sh`. As regras de envelope, filas e retentativas estão no [contrato de mensagens](contratos-de-mensagens.md).

## Painel do RabbitMQ

O broker não tem endereço público. O painel é acessado por um túnel do `kubectl`:

```bash
kubectl port-forward -n messaging svc/rabbitmq 15672:15672
kubectl get secret rabbitmq-credentials -n messaging -o jsonpath='{.data.password}' | base64 -d; echo
# http://localhost:15672, usuário oficina, vhost oficina
```

Cada fila de consumo tem três filas de espera e uma DLQ:

| Fila | Quem consome | Retentativas | DLQ |
|---|---|---|---|
| `os.saga-events` | OS Service | `os.saga-events.retry.1/2/3` (5 s, 30 s, 2 min) | `os.saga-events.dlq` |
| `billing.commands` | Billing Service | `billing.commands.retry.1/2/3` | `billing.commands.dlq` |
| `execution.commands` | Execution Service | `execution.commands.retry.1/2/3` | `execution.commands.dlq` |

As filas `.retry.N` não têm consumidor: a mensagem fica lá até o prazo vencer e volta sozinha para a fila principal.

## Por que uma mensagem cai na DLQ

| Situação | Caminho | Log do serviço |
|---|---|---|
| JSON inválido, envelope incompleto, `type`/`version` sem handler | Direto para a DLQ | `Rejecting invalid message ...` (warn) |
| Handler lança `InvalidMessageException` (ex.: OS sem saga, `execution.job.enqueue` sem itens) | Direto para a DLQ | `Rejecting ...` (warn) |
| Qualquer outro erro (banco fora, Mercado Pago fora, job que ainda não existe) | 3 retentativas, depois DLQ | `Failed ..., retry N via ...` (warn) e, no fim, `sent to dead letter queue` (error) |

Para achar o motivo:

```bash
kubectl logs -n oficina deployment/oficina-backend | grep -E "dead letter|Rejecting"
kubectl logs -n billing deployment/oficina-billing-service | grep -E "dead letter|Rejecting"
kubectl logs -n execution deployment/oficina-execution-service | grep -E "dead letter|Rejecting"
```

No painel, *Queues* → a fila `.dlq` → *Get messages* mostra o envelope (com `messageId`, `sagaId` e `orderId`) sem tirar a mensagem da fila, se o modo escolhido for *Nack message requeue true*.

## Reprocessar

1. **Corrija a causa antes.** Reprocessar uma mensagem que falha pelo mesmo motivo só a devolve para a DLQ.
2. No painel: *Queues* → a fila `.dlq` → *Move messages* → destino: a fila principal (ex.: `billing.commands`). O plugin de shovel, ligado pelo `oficina-infra-k8s`, move todas as mensagens da DLQ e se desfaz sozinho no fim.
3. Acompanhe pelo log do serviço e pela saga da OS (`GET /api/service-orders/:id/saga`).

A mensagem movida mantém o cabeçalho `x-retry-count` da última tentativa, então ela tem **uma** nova chance: se falhar de novo, volta direto para a DLQ, sem passar outra vez pelas filas de espera.

Reprocessar é seguro mesmo que a mensagem já tenha surtido efeito: o OS e o Billing guardam o `messageId` de cada mensagem processada (`processed_messages`) e confirmam a repetida sem efeito; o Execution é idempotente pelo estado do job (ADR-012).

**Mensagem que não chega a sair.** Se o broker estiver fora, ou se não houver fila ligada à routing key (publicação `mandatory` devolvida), a mensagem fica pendente no outbox do serviço que a gerou e é publicada sozinha quando o problema passa: `outbox_messages` com `publishedAt` nulo no OS e no Billing, `pendingEvents` do job no Execution.

**Métrica.** Hoje o sinal é o log de erro `sent to dead letter queue`. A métrica de mensagens na DLQ entra com a observabilidade da etapa 9.

## Demonstração: `scripts/demo-saga.sh`

Roda um cenário por vez pelo API Gateway, com os dados do seed (cliente Carlos Silva, CPF `52998224725`, serviço *Troca de Óleo*, peça `FO001`), e confere o resultado esperado de cada um.

**Pré-requisitos:** `curl`, `jq`; a infra e os três serviços no ar com o seed aplicado; para S6 e S7, `kubectl` apontando para o cluster. A URL do gateway vem do `terraform output` do `oficina-lambda-auth` (pasta vizinha) ou da variável `API_URL`.

```bash
./scripts/demo-saga.sh s1
API_URL=https://<id>.execute-api.sa-east-1.amazonaws.com ./scripts/demo-saga.sh s2
```

| Cenário | O que o script faz | Resultado conferido |
|---|---|---|
| `s1` | Abre a OS, pede aprovação, o cliente aprova, **você paga** no checkout com titular `APRO`, o mecânico executa, a OS é entregue | OS `DELIVERED`, saga `COMPLETED` |
| `s2` | O cliente recusa o orçamento | OS `CANCELED`, saga `COMPENSATED`, orçamento cancelado no Billing |
| `s3` | O cliente aprova e **você paga** com titular `OTHE` | OS `CANCELED`, saga `COMPENSATED`, peças devolvidas, pagamento `REJECTED` (ver a limitação abaixo) |
| `s4` | Pagamento `APRO`, depois o mecânico registra a falha (peça indisponível) | OS `CANCELED`, job `FAILED`, peças devolvidas, estorno pedido |
| `s5` | O cliente aprova e ninguém paga | Ao vencer `SAGA_PAYMENT_TIMEOUT_SECONDS`: OS `CANCELED`, saga `COMPENSATED`, peças devolvidas |
| `s6` | Derruba o Billing (`replicas=0`), pede a aprovação, mostra o comando esperando em `billing.commands`, sobe o Billing | O orçamento é gerado com o comando que esperou; nada se perde |
| `s7` | Liga uma fila de captura, roda até o orçamento e republica, idênticos, `billing.budget.create` e `billing.budget.created` | Mesmo orçamento, saga sem passos novos, "Duplicate" nos logs |

Observações:

- **Pagamento (S1, S3, S4).** O script mostra o link do checkout e espera. Antes de abrir o link, entre em mercadopago.com.br numa janela anônima com o **usuário** do comprador de teste (formato `TESTUSER...`, do painel *Suas integrações → Contas de teste*; o campo não aceita o e-mail dele). Se pedir código de verificação, são os 6 últimos dígitos do ID da conta de teste. Sem esse login, o checkout responde só "Ops, ocorreu um erro" e não cria pagamento nenhum. Pague com CPF `12345678909`. O titular do cartão (`APRO`/`OTHE`) só pode ser escolhido num cartão novo: o cartão já salvo no comprador de teste mantém o nome com que foi cadastrado.
- **Limitação do sandbox no S3.** Com o cartão de teste `OTHE` ("Recusado por erro geral"), o Checkout Pro do sandbox mostra uma tela de erro e **não cria o pagamento recusado**: a consulta de pagamentos da conta não mostra tentativa nenhuma, e nenhum aviso chega ao webhook. Aconteceu em duas sessões (16 e 17/11/2026), com o cartão copiado do painel. Sem pagamento, a OS só é cancelada quando vence o prazo, que é o S5; por isso o script do S3 falha se o pagamento terminar `EXPIRED` em vez de `REJECTED`. O caminho da recusa (webhook → nova consulta ao Mercado Pago → `billing.payment.failed` → saga cancela o orçamento e devolve as peças) é coberto pelos testes de integração do Billing e da saga do OS, e a compensação em si é a mesma que o S5 mostra ao vivo.
- **Estorno (S4).** A API de estornos do Mercado Pago exige as credenciais de produção ativadas na conta. Sem isso, o comando de estorno passa pelas retentativas e cai em `billing.commands.dlq`, e a saga fica em `REFUNDING`: é o caso de reprocessar pela DLQ depois de ativar as credenciais.
- **Prazo (S5).** O prazo é o `SAGA_PAYMENT_TIMEOUT_SECONDS` do ConfigMap do OS. Para a gravação, um valor curto ajuda:

  ```bash
  kubectl patch configmap oficina-backend-config -n oficina --type merge -p '{"data":{"SAGA_PAYMENT_TIMEOUT_SECONDS":"120"}}'
  kubectl rollout restart deployment/oficina-backend -n oficina
  ```

  O próximo deploy do OS volta o valor do arquivo `k8s/configmap.yaml`.
- **Duplicatas (S7).** A republicação usa a API de gerenciamento do RabbitMQ (a mesma do botão *Publish message* do painel), por um `port-forward` aberto e fechado pelo script.
