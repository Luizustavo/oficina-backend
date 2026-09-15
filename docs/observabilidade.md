# Observabilidade

Instrumentação com **OpenTelemetry**, exportando para o **New Relic**.

A escolha do OpenTelemetry é deliberada: é padrão aberto e neutro de fornecedor. Trocar o New Relic por Datadog, Grafana Cloud ou SigNoz é mudar duas variáveis de ambiente (`OTEL_EXPORTER_OTLP_ENDPOINT` e a chave), sem tocar em uma linha de código instrumentado.

---

## O que está instrumentado

| Sinal | Como | Onde |
|---|---|---|
| **Traces** | Auto-instrumentação de HTTP, Express, NestJS e Postgres | `infrastructure/observability/tracing.ts` |
| **Latência de API** | Sai dos spans HTTP, sem código adicional | idem |
| **Tempo de query** | Sai dos spans do driver `pg` | idem |
| **Logs JSON** | Pino, com `trace_id`, `span_id` e `requestId` em toda linha | `infrastructure/observability/logging.config.ts` |
| **Métricas de negócio** | Contador e histograma nas transições de ordem de serviço | `infrastructure/observability/service-order.metrics.ts` |
| **Falhas de integração** | Contador e histograma nas chamadas externas | `infrastructure/observability/integration.metrics.ts` |
| **CPU/memória do K8s** | Integração Kubernetes do New Relic (ver abaixo) | fora da aplicação |
| **Healthcheck/uptime** | `/api/health/live` e `/api/health/ready` + probes | `controllers/health.controller.ts` |

### Correlação entre requisições

Toda linha de log carrega três identificadores:

```json
{
  "level": 40,
  "msg": "Login failed - user not found or inactive",
  "trace_id": "45345065c2df993c059f7504fbc2f682",
  "span_id":  "a8fb407cd83d8e74",
  "req": { "id": "f545bcd2-ec9c-4cc6-a7a6-667c12b15e93" },
  "service": "oficina-backend"
}
```

- `trace_id` / `span_id` — injetados pela instrumentação Pino do OpenTelemetry. Ligam o log ao trace distribuído: no New Relic dá para pular de uma linha de log para o trace inteiro da requisição.
- `req.id` — vem do header `x-request-id` quando o cliente ou o API Gateway manda um, e é gerado quando não manda. Volta na resposta no mesmo header, para o usuário conseguir citá-lo ao reportar um erro.

Os casos de uso continuam injetando `Logger` de `@nestjs/common`, como manda a convenção do projeto. `app.useLogger()` troca o destino por baixo — nenhum caso de uso precisou mudar, e os logs deles saem correlacionados do mesmo jeito.

### O que nunca vai para o log

`redact` em `logging.config.ts` censura `authorization`, `cookie`, `password`, `cpf` e `document`. Log sai do cluster; dado pessoal e credencial não podem sair junto.

Healthchecks são ignorados em log e em trace: o Kubernetes bate a cada 10 segundos em cada pod, e isso dominaria o volume sem informar nada.

---

## Configuração

| Variável | Onde | Para quê |
|---|---|---|
| `NEW_RELIC_LICENSE_KEY` | Secret | Chave de ingestão (tipo `INGEST - LICENSE`) |
| `OTEL_ENABLED` | ConfigMap | Liga a telemetria. Desligada em teste por padrão |
| `OTEL_SERVICE_NAME` | ConfigMap | Nome do serviço nos painéis |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | ConfigMap | `https://otlp.nr-data.net` |
| `LOG_LEVEL` | ConfigMap | `info` em produção, `debug` em desenvolvimento |

Sem `NEW_RELIC_LICENSE_KEY`, a telemetria fica desligada e a aplicação roda normalmente — útil para desenvolvimento local.

### Métricas de infraestrutura do Kubernetes

CPU e memória dos pods vêm da integração Kubernetes do New Relic, instalada no cluster:

```bash
helm repo add newrelic https://helm-charts.newrelic.com
helm upgrade --install newrelic-bundle newrelic/nri-bundle \
  --namespace newrelic --create-namespace \
  --set global.licenseKey="$NEW_RELIC_LICENSE_KEY" \
  --set global.cluster=oficina-k3s \
  --set kube-state-metrics.enabled=true \
  --set newrelic-infrastructure.privileged=true \
  --set nodeSelector."kubernetes\.io/os"=linux
```

> **Atenção ao tamanho do nó.** O cluster é um k3s de nó único numa `t3.small` (2 GB). O `nri-bundle` completo pode apertar a memória disponível para os pods da aplicação. Se o nó ficar sob pressão, desligue os componentes que não são necessários para a entrega (`--set newrelic-logging.enabled=false`, já que os logs vão por OTLP direto da aplicação).

### Temporalidade das métricas

O exportador é configurado com temporalidade **delta**, e não com o padrão **cumulativa**:

```ts
temporalityPreference: AggregationTemporalityPreference.DELTA
```

Não é detalhe de afinação. Com temporalidade cumulativa, cada contador reporta o total acumulado desde o início do processo, e cabe ao New Relic derivar o incremento entre pontos consecutivos. O primeiro ponto de cada série não tem antecessor, então o valor dele se perde.

O efeito foi medido: seis ordens criadas apareciam como **três**, e três entregas como **nenhuma**. Com um Deployment de várias réplicas o erro se multiplica, porque cada pod inicia a própria série. Depois da troca para delta, uma medição controlada de quatro criações e duas entregas devolveu exatamente `4` e `2`.

---

## Dashboards

Os três painéis exigidos pela Fase 3. Crie em **New Relic → Dashboards → Create a dashboard**, adicionando cada consulta como um widget.

### 1. Volume diário de ordens de serviço

```sql
SELECT sum(`service_order.status_changed`)
FROM Metric
WHERE to_status = 'RECEIVED'
FACET dateOf(timestamp)
SINCE 30 days ago
```

Ordens criadas por dia. O filtro `to_status = 'RECEIVED'` isola a criação — as demais transições usam a mesma métrica com outros valores.

### 2. Tempo médio de execução por status

```sql
SELECT average(`service_order.status_duration`)
FROM Metric
FACET from_status
SINCE 7 days ago
TIMESERIES
```

Quanto tempo, em segundos, a ordem passa em cada status antes de sair dele. É o que responde "onde a oficina está travando": diagnóstico, execução ou finalização.

Para ver a cauda em vez da média — que é o que dói para o cliente:

```sql
SELECT percentile(`service_order.status_duration`, 50, 95, 99)
FROM Metric
FACET from_status
SINCE 7 days ago
```

### 3. Erros e falhas nas integrações

```sql
SELECT sum(`integration.call`)
FROM Metric
WHERE outcome = 'failure'
FACET integration, reason
SINCE 24 hours ago
TIMESERIES
```

Taxa de falha, em percentual:

```sql
SELECT percentage(sum(`integration.call`), WHERE outcome = 'failure')
FROM Metric
FACET integration
SINCE 24 hours ago
TIMESERIES
```

### Painéis de infraestrutura

Latência das APIs:

```sql
SELECT average(`duration.ms`), percentile(`duration.ms`, 95, 99)
FROM Span
WHERE service.name = 'oficina-backend' AND span.kind = 'server'
FACET name
SINCE 1 hour ago
TIMESERIES
```

Taxa de erro HTTP:

```sql
SELECT percentage(count(*), WHERE otel.status_code = 'ERROR')
FROM Span
WHERE service.name = 'oficina-backend' AND span.kind = 'server'
SINCE 1 hour ago
TIMESERIES
```

CPU e memória dos pods:

```sql
SELECT average(cpuUsedCores), average(memoryWorkingSetBytes / 1e6)
FROM K8sContainerSample
WHERE clusterName = 'oficina-k3s'
FACET podName
SINCE 1 hour ago
TIMESERIES
```

> **Duas armadilhas confirmadas na prática**, ao montar o dashboard contra dados reais:
>
> **O campo de duração do span é `duration.ms`, não `duration`.** Em spans vindos por OTLP, `duration` chega nulo, e `percentile(duration, 95)` devolve `0` sem erro nenhum — um painel silenciosamente errado. `duration.ms` já está em milissegundos, então não multiplique por 1000.
>
> **Janelas maiores que ~2 dias não enxergam dado recente.** O New Relic responde consultas longas a partir de tabelas de rollup agregadas por hora e por dia; dado ingerido há minutos ainda não foi agregado e some do resultado. `SINCE 7 days ago` retornava vazio enquanto `SINCE 2 days ago` retornava cinco facetas, com exatamente os mesmos dados. Para demonstração, use janelas curtas.

---

## Alertas

Crie em **Alerts → Alert conditions → NRQL**.

### Falha no processamento de ordens de serviço

Exigido nominalmente pela Fase 3.

```sql
SELECT count(*)
FROM Span
WHERE service.name = 'oficina-backend'
  AND name LIKE '%service-orders%'
  AND otel.status_code = 'ERROR'
```

Dispara com **mais de 3 ocorrências em 5 minutos**.

### Latência degradada

```sql
SELECT percentile(`duration.ms`, 95)
FROM Span
WHERE service.name = 'oficina-backend' AND span.kind = 'server'
```

Dispara acima de **2000** (2 segundos, em milissegundos).

### Aplicação fora do ar

```sql
SELECT count(*)
FROM Span
WHERE service.name = 'oficina-backend'
```

Dispara quando o resultado for **zero por 5 minutos** — nenhum tráfego chegando significa aplicação fora ou gateway quebrado.

### Integração externa degradada

```sql
SELECT percentage(sum(`integration.call`), WHERE outcome = 'failure')
FROM Metric
FACET integration
```

Dispara acima de **20% por 10 minutos**.

### Ordens presas em um status

Sinal de negócio, não de infraestrutura: ordens paradas há muito tempo em diagnóstico.

```sql
SELECT average(`service_order.status_duration`)
FROM Metric
WHERE from_status = 'IN_DIAGNOSIS'
```

Dispara acima de **172800** (48 horas, em segundos).

---

## Verificação local

Para conferir que a instrumentação está funcionando sem mandar nada para o New Relic:

```bash
OTEL_ENABLED=true \
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 \
NODE_ENV=production \
npm run start:prod
```

A exportação vai falhar (não há coletor na porta 4318), mas a instrumentação roda igual. Faça uma requisição e confira que as linhas de log trazem `trace_id`:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"x@y.com","password":"z"}'
```

Todas as linhas geradas por essa requisição — incluindo as do caso de uso — devem compartilhar o mesmo `trace_id`.

---

## Ordem de carga do OpenTelemetry

`startTracing()` é chamado no topo de `src/main.ts`, **antes de qualquer outro import**. Isso não é estilo: as instrumentações automáticas funcionam substituindo métodos dos módulos que instrumentam (`http`, `express`, `pg`, `nestjs`), e só conseguem fazer isso se rodarem antes desses módulos serem carregados.

Mover um import para cima dessa linha desliga a telemetria **em silêncio** — sem erro, sem aviso, só sem dados. É a falha mais comum e mais difícil de diagnosticar em instrumentação OpenTelemetry.
