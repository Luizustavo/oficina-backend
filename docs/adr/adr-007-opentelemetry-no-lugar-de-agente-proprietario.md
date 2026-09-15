# ADR-007 — OpenTelemetry no lugar do agente do fornecedor

**Status:** Aceita · **Data:** 2026-09-13

## Contexto

A Fase 3 exige monitorar latência de API, recursos do Kubernetes, healthcheck, alertas e logs estruturados com correlação, com escolha livre de ferramenta. A escolhida foi **New Relic** (free tier permanente de 100 GB/mês, sem infraestrutura para manter).

O New Relic oferece dois caminhos: o agente Node.js proprietário (`newrelic`), ou ingestão OTLP a partir de OpenTelemetry.

O agente proprietário é mais fácil: um `require('newrelic')` e pronto, com instrumentação mais profunda e dashboards pré-montados.

## Decisão

**OpenTelemetry**, exportando via OTLP para o endpoint do New Relic.

```
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp.nr-data.net
header: api-key: <NEW_RELIC_LICENSE_KEY>
```

## Justificativa

**Trocar de fornecedor vira mudança de configuração.** Datadog, Grafana Cloud, SigNoz e Honeycomb aceitam OTLP. Migrar é alterar duas variáveis de ambiente — nenhuma linha de código instrumentado muda. Com o agente proprietário, migrar significaria reinstrumentar tudo.

Isso não é hipótese distante neste projeto: a escolha do fornecedor mudou **duas vezes** durante a Fase 3 (SigNoz self-hosted → SigNoz Cloud → New Relic), por restrição de memória do nó e por custo. Com OTel, nenhuma dessas mudanças teria custado código.

**É padrão CNCF**, não produto. A instrumentação sobrevive ao fornecedor.

**As métricas de negócio são portáveis.** `service_order.status_changed` e `service_order.status_duration` são métricas OTel comuns, legíveis por qualquer backend compatível.

## Consequências

**Positivas**
- Independência de fornecedor sem custo adicional.
- Auto-instrumentação de `http`, `express`, `nestjs` e `pg` entrega latência de rota e tempo de query sem código.
- `trace_id` e `span_id` injetados nos logs pela instrumentação Pino, o que dá a correlação exigida pela fase.
- Traces, métricas e logs saem pelo mesmo pipeline e configuração.

**Negativas**
- **Mais configuração manual** que o agente: exportadores, resource attributes e ordem de carregamento ficam por nossa conta.
- **Instrumentação menos profunda.** O agente do New Relic conhece particularidades do runtime Node que a auto-instrumentação genérica não captura.
- **Dashboards não vêm prontos.** As consultas NRQL dos três painéis exigidos foram escritas à mão ([observabilidade.md](../observabilidade.md)).
- **Os nomes de métrica podem variar** conforme a versão do exportador, exigindo conferência no Data Explorer antes de fixar um dashboard.

## A armadilha da ordem de carregamento

`startTracing()` é chamado no topo de `main.ts`, **antes de qualquer outro import**. Não é estilo: as auto-instrumentações funcionam substituindo métodos dos módulos que instrumentam, e só conseguem fazer isso se rodarem antes desses módulos serem carregados.

Mover qualquer import para cima dessa linha **desliga a telemetria em silêncio** — sem erro, sem aviso, só sem dados. É a falha mais comum e mais difícil de diagnosticar em instrumentação OpenTelemetry, e está comentada no código e documentada.
