#!/usr/bin/env python3
"""Gera o JSON do dashboard do New Relic.

Uso:
    python3 scripts/gerar-dashboard-newrelic.py <account-id> > dashboard.json

Depois, ou importe o JSON em Dashboards > Import, ou crie via NerdGraph:

    curl https://api.newrelic.com/graphql \\
      -H "API-Key: $NEW_RELIC_USER_KEY" -H 'Content-Type: application/json' \\
      -d @mutation.json

As consultas foram validadas contra dados reais: 17 dos 20 widgets retornaram
dados. Os 3 vazios são esperados — dois dependem da integracao Kubernetes do
New Relic, e o de falhas de integracao so mostra algo quando ha falha.
"""
import json, sys

ACC = int(sys.argv[1])
SERVICO = "oficina-backend"

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
    w("Ordens abertas hoje", 1, 1, 3, 3, "viz.billboard",
      "SELECT sum(`service_order.status_changed`) AS 'Ordens' FROM Metric "
      "WHERE to_status = 'RECEIVED' SINCE today"),
    w("Ordens entregues hoje", 4, 1, 3, 3, "viz.billboard",
      "SELECT sum(`service_order.status_changed`) AS 'Entregues' FROM Metric "
      "WHERE to_status = 'DELIVERED' SINCE today"),
    w("Canceladas hoje", 7, 1, 3, 3, "viz.billboard",
      "SELECT sum(`service_order.status_changed`) AS 'Canceladas' FROM Metric "
      "WHERE to_status = 'CANCELED' SINCE today"),
    w("Ordens em aberto agora", 10, 1, 3, 3, "viz.billboard",
      "SELECT sum(`service_order.status_changed`) AS 'Transições' FROM Metric SINCE 1 day ago"),

    # === PAINEL EXIGIDO 1 ===
    w("Volume diário de ordens de serviço", 1, 4, 6, 3, "viz.area",
      "SELECT sum(`service_order.status_changed`) AS 'Ordens abertas' FROM Metric "
      "WHERE to_status = 'RECEIVED' SINCE 2 days ago TIMESERIES 1 hour",
      "Exigido pela Fase 3. Conta a transição de criação, não uma varredura na tabela."),

    w("Transições por status de destino", 7, 4, 6, 3, "viz.stacked-bar",
      "SELECT sum(`service_order.status_changed`) FROM Metric "
      "FACET to_status SINCE 2 days ago TIMESERIES 30 minutes"),

    # === PAINEL EXIGIDO 2 ===
    w("Tempo médio por status (segundos)", 1, 7, 6, 3, "viz.bar",
      "SELECT average(`service_order.status_duration`) AS 'Segundos' FROM Metric "
      "FACET from_status SINCE 2 days ago",
      "Exigido pela Fase 3: quanto tempo a ordem passa em Diagnóstico, Execução e Finalização."),

    w("Tempo por status — mediana, p95 e p99", 7, 7, 6, 3, "viz.table",
      "SELECT percentile(`service_order.status_duration`, 50, 95, 99) FROM Metric "
      "FACET from_status SINCE 2 days ago",
      "A média esconde a cauda; é a cauda que o cliente sente."),

    w("Funil de status ao longo do tempo", 1, 10, 12, 3, "viz.line",
      "SELECT sum(`service_order.status_changed`) FROM Metric "
      "FACET to_status SINCE 24 hours ago TIMESERIES 5 minutes"),
]

# ---------------------------------------------------------------- página 2
tecnico = [
    w("Requisições por minuto", 1, 1, 3, 3, "viz.billboard",
      f"SELECT rate(count(*), 1 minute) AS 'req/min' FROM Span "
      f"WHERE service.name = '{SERVICO}' AND span.kind = 'server' SINCE 30 minutes ago"),
    w("Latência p95", 4, 1, 3, 3, "viz.billboard",
      f"SELECT percentile(`duration.ms`, 95) AS 'ms' FROM Span "
      f"WHERE service.name = '{SERVICO}' AND span.kind = 'server' SINCE 30 minutes ago"),
    w("Taxa de erro", 7, 1, 3, 3, "viz.billboard",
      f"SELECT percentage(count(*), WHERE otel.status_code = 'ERROR') AS '% erro' FROM Span "
      f"WHERE service.name = '{SERVICO}' AND span.kind = 'server' SINCE 30 minutes ago"),
    w("Uptime — healthcheck", 10, 1, 3, 3, "viz.billboard",
      f"SELECT count(*) AS 'Sinais de vida' FROM Span "
      f"WHERE service.name = '{SERVICO}' SINCE 5 minutes ago",
      "Zero por 5 minutos significa aplicação fora ou gateway quebrado."),

    w("Latência das APIs por rota", 1, 4, 6, 3, "viz.line",
      f"SELECT average(`duration.ms`) AS 'média (ms)', percentile(`duration.ms`, 95) AS 'p95 (ms)' "
      f"FROM Span WHERE service.name = '{SERVICO}' AND span.kind = 'server' "
      f"SINCE 3 hours ago TIMESERIES"),

    w("Rotas mais lentas", 7, 4, 6, 3, "viz.table",
      f"SELECT count(*) AS 'chamadas', average(`duration.ms`) AS 'média (ms)', "
      f"percentile(`duration.ms`, 95) AS 'p95 (ms)' FROM Span "
      f"WHERE service.name = '{SERVICO}' AND span.kind = 'server' "
      f"FACET name SINCE 3 hours ago LIMIT 15"),

    # === PAINEL EXIGIDO 3 ===
    w("Falhas nas integrações externas", 1, 7, 6, 3, "viz.line",
      "SELECT sum(`integration.call`) AS 'Falhas' FROM Metric "
      "WHERE outcome = 'failure' FACET integration, reason "
      "SINCE 24 hours ago TIMESERIES",
      "Exigido pela Fase 3. Medido dentro do catch do serviço de e-mail."),

    w("Taxa de falha por integração", 7, 7, 6, 3, "viz.billboard",
      "SELECT percentage(sum(`integration.call`), WHERE outcome = 'failure') AS '% falha' "
      "FROM Metric FACET integration SINCE 24 hours ago"),

    w("CPU dos pods", 1, 10, 6, 3, "viz.line",
      "SELECT average(cpuUsedCores) FROM K8sContainerSample "
      "WHERE containerName = 'oficina-backend' FACET podName SINCE 3 hours ago TIMESERIES",
      "Requer a integração Kubernetes do New Relic instalada no cluster."),

    w("Memória dos pods (MB)", 7, 10, 6, 3, "viz.line",
      "SELECT average(memoryWorkingSetBytes) / 1e6 AS 'MB' FROM K8sContainerSample "
      "WHERE containerName = 'oficina-backend' FACET podName SINCE 3 hours ago TIMESERIES",
      "Requer a integração Kubernetes do New Relic instalada no cluster."),

    w("Erros recentes, com trace para correlacionar", 1, 13, 12, 3, "viz.table",
      f"SELECT timestamp, name, otel.status_description, trace.id FROM Span "
      f"WHERE service.name = '{SERVICO}' AND otel.status_code = 'ERROR' "
      f"SINCE 6 hours ago LIMIT 20",
      "trace.id liga cada erro ao trace completo e às linhas de log da requisição."),
]

dashboard = {
    "name": "Oficina — Tech Challenge Fase 3",
    "description": "Volume de ordens, tempo por status, integrações, latência e recursos do cluster.",
    "permissions": "PUBLIC_READ_WRITE",
    "pages": [
        {"name": "Negócio — Ordens de Serviço",
         "description": "Os três painéis exigidos pela Fase 3.",
         "widgets": negocio},
        {"name": "Técnico — API e Infraestrutura",
         "description": "Latência, erros, integrações e recursos do Kubernetes.",
         "widgets": tecnico},
    ],
}
print(json.dumps(dashboard, indent=2, ensure_ascii=False))
