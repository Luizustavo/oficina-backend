#!/usr/bin/env python3
"""Gera o JSON do dashboard do New Relic.

Uso:
    python3 scripts/gerar-dashboard-newrelic.py <account-id> > dashboard.json

Depois, ou importe o JSON em Dashboards > Import, ou crie via NerdGraph:

    curl https://api.newrelic.com/graphql \\
      -H "API-Key: $NEW_RELIC_USER_KEY" -H 'Content-Type: application/json' \\
      -d @mutation.json

As consultas das páginas 1 e 2 foram validadas contra dados reais na Fase 3
(17 de 20 widgets com dados; os vazios dependem da integração Kubernetes do New
Relic ou de haver falha). As da página 3 (Fase 4) usam as métricas e os spans
de mensageria dos três serviços.
"""
import json, sys

ACC = int(sys.argv[1])
AREA = "viz.area"
BAR = "viz.bar"
BILLBOARD = "viz.billboard"
LINE = "viz.line"
PIE = "viz.pie"
STACKED_BAR = "viz.stacked-bar"
TABLE = "viz.table"

SERVICO = "oficina-backend"
SERVICOS = "('oficina-backend', 'oficina-billing-service', 'oficina-execution-service')"

def w(titulo, col, row, larg, alt, viz, nrql, nota=None):
    cfg = {
        "nrqlQueries": [{"accountIds": [ACC], "query": nrql}],
        "platformOptions": {"ignoreTimeRange": False},
    }
    if nota:
        cfg["description"] = nota
    return {
        "title": titulo,
        "layout": {"column": col, "row": row, "width": larg, "height": alt},
        "linkedEntityGuids": None,
        "visualization": {"id": viz},
        "rawConfiguration": cfg,
    }

# ---------------------------------------------------------------- página 1
negocio = [
    w("Ordens abertas hoje", 1, 1, 3, 3, BILLBOARD,
      "SELECT sum(`service_order.status_changed`) AS 'Ordens' FROM Metric "
      "WHERE to_status = 'RECEIVED' SINCE today"),
    w("Ordens entregues hoje", 4, 1, 3, 3, BILLBOARD,
      "SELECT sum(`service_order.status_changed`) AS 'Entregues' FROM Metric "
      "WHERE to_status = 'DELIVERED' SINCE today"),
    w("Canceladas hoje", 7, 1, 3, 3, BILLBOARD,
      "SELECT sum(`service_order.status_changed`) AS 'Canceladas' FROM Metric "
      "WHERE to_status = 'CANCELED' SINCE today"),
    w("Ordens em aberto agora", 10, 1, 3, 3, BILLBOARD,
      "SELECT sum(`service_order.status_changed`) AS 'Transições' FROM Metric SINCE 1 day ago"),

    # === PAINEL EXIGIDO 1 ===
    w("Volume diário de ordens de serviço", 1, 4, 6, 3, AREA,
      "SELECT sum(`service_order.status_changed`) AS 'Ordens abertas' FROM Metric "
      "WHERE to_status = 'RECEIVED' SINCE 2 days ago TIMESERIES 1 hour",
      "Exigido pela Fase 3. Conta a transição de criação, não uma varredura na tabela."),

    w("Transições por status de destino", 7, 4, 6, 3, STACKED_BAR,
      "SELECT sum(`service_order.status_changed`) FROM Metric "
      "FACET to_status SINCE 2 days ago TIMESERIES 30 minutes"),

    # === PAINEL EXIGIDO 2 ===
    w("Tempo médio por status (segundos)", 1, 7, 6, 3, BAR,
      "SELECT average(`service_order.status_duration`) AS 'Segundos' FROM Metric "
      "FACET from_status SINCE 2 days ago",
      "Exigido pela Fase 3: quanto tempo a ordem passa em Diagnóstico, Execução e Finalização."),

    w("Tempo por status — mediana, p95 e p99", 7, 7, 6, 3, TABLE,
      "SELECT percentile(`service_order.status_duration`, 50, 95, 99) FROM Metric "
      "FACET from_status SINCE 2 days ago",
      "A média esconde a cauda; é a cauda que o cliente sente."),

    w("Funil de status ao longo do tempo", 1, 10, 12, 3, LINE,
      "SELECT sum(`service_order.status_changed`) FROM Metric "
      "FACET to_status SINCE 24 hours ago TIMESERIES 5 minutes"),
]

# ---------------------------------------------------------------- página 2
tecnico = [
    w("Requisições por minuto", 1, 1, 3, 3, BILLBOARD,
      f"SELECT rate(count(*), 1 minute) AS 'req/min' FROM Span "
      f"WHERE service.name = '{SERVICO}' AND span.kind = 'server' SINCE 30 minutes ago"),
    w("Latência p95", 4, 1, 3, 3, BILLBOARD,
      f"SELECT percentile(`duration.ms`, 95) AS 'ms' FROM Span "
      f"WHERE service.name = '{SERVICO}' AND span.kind = 'server' SINCE 30 minutes ago"),
    w("Taxa de erro", 7, 1, 3, 3, BILLBOARD,
      f"SELECT percentage(count(*), WHERE otel.status_code = 'ERROR') AS '% erro' FROM Span "
      f"WHERE service.name = '{SERVICO}' AND span.kind = 'server' SINCE 30 minutes ago"),
    w("Uptime — healthcheck", 10, 1, 3, 3, BILLBOARD,
      f"SELECT count(*) AS 'Sinais de vida' FROM Span "
      f"WHERE service.name = '{SERVICO}' SINCE 5 minutes ago",
      "Zero por 5 minutos significa aplicação fora ou gateway quebrado."),

    w("Latência das APIs por rota", 1, 4, 6, 3, LINE,
      f"SELECT average(`duration.ms`) AS 'média (ms)', percentile(`duration.ms`, 95) AS 'p95 (ms)' "
      f"FROM Span WHERE service.name = '{SERVICO}' AND span.kind = 'server' "
      f"SINCE 3 hours ago TIMESERIES"),

    w("Rotas mais lentas", 7, 4, 6, 3, TABLE,
      f"SELECT count(*) AS 'chamadas', average(`duration.ms`) AS 'média (ms)', "
      f"percentile(`duration.ms`, 95) AS 'p95 (ms)' FROM Span "
      f"WHERE service.name = '{SERVICO}' AND span.kind = 'server' "
      f"FACET name SINCE 3 hours ago LIMIT 15"),

    # === PAINEL EXIGIDO 3 ===
    w("Falhas nas integrações externas", 1, 7, 6, 3, LINE,
      "SELECT sum(`integration.call`) AS 'Falhas' FROM Metric "
      "WHERE outcome = 'failure' FACET integration, reason "
      "SINCE 24 hours ago TIMESERIES",
      "Exigido pela Fase 3. Medido dentro do catch do serviço de e-mail."),

    w("Taxa de falha por integração", 7, 7, 6, 3, BILLBOARD,
      "SELECT percentage(sum(`integration.call`), WHERE outcome = 'failure') AS '% falha' "
      "FROM Metric FACET integration SINCE 24 hours ago"),

    w("CPU dos pods", 1, 10, 6, 3, LINE,
      "SELECT average(cpuUsedCores) FROM K8sContainerSample "
      "WHERE containerName = 'oficina-backend' FACET podName SINCE 3 hours ago TIMESERIES",
      "Requer a integração Kubernetes do New Relic instalada no cluster."),

    w("Memória dos pods (MB)", 7, 10, 6, 3, LINE,
      "SELECT average(memoryWorkingSetBytes) / 1e6 AS 'MB' FROM K8sContainerSample "
      "WHERE containerName = 'oficina-backend' FACET podName SINCE 3 hours ago TIMESERIES",
      "Requer a integração Kubernetes do New Relic instalada no cluster."),

    w("Erros recentes, com trace para correlacionar", 1, 13, 12, 3, TABLE,
      f"SELECT timestamp, name, otel.status_description, trace.id FROM Span "
      f"WHERE service.name = '{SERVICO}' AND otel.status_code = 'ERROR' "
      f"SINCE 6 hours ago LIMIT 20",
      "trace.id liga cada erro ao trace completo e às linhas de log da requisição."),
]

# ---------------------------------------------------------------- página 3
# Fase 4: a saga atravessando OS, Billing e Execution. Métricas emitidas por
# saga.metrics.ts (OS), billing.metrics.ts e execution.metrics.ts; os spans de
# mensageria vêm de message-tracing.ts, com o desfecho em `oficina.outcome`.
saga = [
    w("Sagas iniciadas (24h)", 1, 1, 3, 3, BILLBOARD,
      "SELECT sum(`saga.started`) AS 'Iniciadas' FROM Metric SINCE 1 day ago"),
    w("Sagas concluídas (24h)", 4, 1, 3, 3, BILLBOARD,
      "SELECT sum(`saga.finished`) AS 'Concluídas' FROM Metric "
      "WHERE status = 'COMPLETED' SINCE 1 day ago"),
    w("Sagas compensadas (24h)", 7, 1, 3, 3, BILLBOARD,
      "SELECT sum(`saga.finished`) AS 'Compensadas' FROM Metric "
      "WHERE status = 'COMPENSATED' SINCE 1 day ago"),
    w("Mensagens na DLQ (24h)", 10, 1, 3, 3, BILLBOARD,
      "SELECT count(*) AS 'Na DLQ' FROM Span WHERE span.kind = 'consumer' "
      "AND oficina.outcome IN ('dead-lettered', 'rejected') SINCE 1 day ago",
      "Mensagens que esgotaram as retentativas ou eram inválidas. Ver operacao-da-mensageria.md."),

    w("Como as sagas terminam", 1, 4, 4, 3, PIE,
      "SELECT sum(`saga.finished`) FROM Metric FACET status SINCE 7 days ago"),
    w("Compensações por motivo", 5, 4, 4, 3, BAR,
      "SELECT sum(`saga.compensations`) FROM Metric FACET trigger SINCE 7 days ago",
      "O motivo é o evento que levou a saga à compensação."),
    w("Duração da saga (s) — mediana e p95", 9, 4, 4, 3, TABLE,
      "SELECT percentile(`saga.duration`, 50, 95) FROM Metric FACET status SINCE 7 days ago"),

    w("Mensagens processadas por fila e desfecho", 1, 7, 6, 3, STACKED_BAR,
      "SELECT count(*) FROM Span WHERE span.kind = 'consumer' "
      "FACET name, oficina.outcome SINCE 1 day ago TIMESERIES 30 minutes"),
    w("Latência p95 por serviço (ms)", 7, 7, 6, 3, LINE,
      f"SELECT percentile(`duration.ms`, 95) FROM Span WHERE span.kind = 'server' "
      f"AND service.name IN {SERVICOS} FACET service.name SINCE 3 hours ago TIMESERIES"),

    w("Pagamentos por status", 1, 10, 4, 3, BAR,
      "SELECT sum(`billing.payments`) FROM Metric FACET status SINCE 7 days ago"),
    w("Avisos do Mercado Pago por desfecho", 5, 10, 4, 3, BAR,
      "SELECT sum(`billing.webhook.received`) FROM Metric FACET outcome SINCE 7 days ago",
      "invalid_signature acima de zero merece olhar: alguém chamando o webhook sem a assinatura."),
    w("Fila de execução agora", 9, 10, 4, 3, BILLBOARD,
      "SELECT max(`execution.queue.size`) FROM Metric FACET status SINCE 5 minutes ago",
      "max, e não soma: cada réplica do Execution lê a mesma fila no MongoDB."),

    w("Jobs encerrados por status", 1, 13, 4, 3, BAR,
      "SELECT sum(`execution.jobs.finished`) FROM Metric FACET status SINCE 7 days ago"),
    w("Duração do reparo (s) — mediana e p95", 5, 13, 4, 3, BILLBOARD,
      "SELECT percentile(`execution.job.duration`, 50, 95) FROM Metric SINCE 7 days ago"),
    w("Sinal de vida por serviço", 9, 13, 4, 3, TABLE,
      "SELECT latest(timestamp) AS 'último sinal' FROM Metric "
      "WHERE metricName = 'service.heartbeat' FACET service.name SINCE 30 minutes ago"),

    w("Erros recentes por serviço, com trace", 1, 16, 12, 3, TABLE,
      f"SELECT timestamp, service.name, name, otel.status_description, trace.id FROM Span "
      f"WHERE service.name IN {SERVICOS} AND otel.status_code = 'ERROR' "
      f"SINCE 6 hours ago LIMIT 20",
      "Abra o trace.id para ver a mensagem atravessando os serviços até o erro."),
]

dashboard = {
    "name": "Oficina — Tech Challenge Fase 4",
    "description": "Ordens de serviço, saga entre OS, Billing e Execution, mensageria, pagamentos e fila de execução.",
    "permissions": "PUBLIC_READ_WRITE",
    "pages": [
        {"name": "Negócio — Ordens de Serviço",
         "description": "Os três painéis exigidos pela Fase 3.",
         "widgets": negocio},
        {"name": "Técnico — API e Infraestrutura",
         "description": "Latência, erros, integrações e recursos do Kubernetes.",
         "widgets": tecnico},
        {"name": "Saga e microsserviços",
         "description": "Fase 4: sagas, compensações, DLQ, pagamentos e fila de execução nos três serviços.",
         "widgets": saga},
    ],
}
print(json.dumps(dashboard, indent=2, ensure_ascii=False))
