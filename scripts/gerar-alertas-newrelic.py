#!/usr/bin/env python3
"""Gera a requisição NerdGraph que cria os alertas da saga (Fase 4).

Uso:
    python3 scripts/gerar-alertas-newrelic.py <account-id> <policy-id> > alertas.json
    curl https://api.newrelic.com/graphql \\
      -H "API-Key: $NEW_RELIC_USER_KEY" -H 'Content-Type: application/json' \\
      -d @alertas.json

A política pode ser a da Fase 3 ou uma nova (Alerts > Alert Policies). Cada
condição volta com o id criado, ou com o erro que o NerdGraph apontar.
"""
import json
import sys

ACC = int(sys.argv[1])
POLICY = sys.argv[2]
SERVICOS = ["oficina-backend", "oficina-billing-service", "oficina-execution-service"]


def condicao(nome, descricao, nrql, termo, janela=60, expiracao=None):
    cond = {
        "name": nome,
        "description": descricao,
        "enabled": True,
        "nrql": {"query": nrql},
        "signal": {
            "aggregationWindow": janela,
            "aggregationMethod": "EVENT_FLOW",
            "aggregationDelay": 120,
        },
        "terms": [termo],
        "violationTimeLimitSeconds": 86400,
    }
    if expiracao:
        cond["expiration"] = {
            "expirationDuration": expiracao,
            "openViolationOnExpiration": True,
            "closeViolationsOnExpiration": False,
        }
    return cond


condicoes = [
    condicao(
        "Mensagem na DLQ",
        "Uma mensagem da saga esgotou as retentativas ou era inválida. "
        "Ver docs/arquitetura/operacao-da-mensageria.md para achar o motivo e reprocessar.",
        "SELECT count(*) FROM Span WHERE span.kind = 'consumer' "
        "AND oficina.outcome IN ('dead-lettered', 'rejected')",
        {"operator": "ABOVE", "threshold": 0, "priority": "CRITICAL",
         "thresholdDuration": 300, "thresholdOccurrences": "AT_LEAST_ONCE"},
    ),
    condicao(
        "Compensações da saga acima do normal",
        "Mais de 3 sagas entraram em compensação em 15 minutos: recusas, pagamentos "
        "recusados ou falhas de execução fora do padrão.",
        "SELECT sum(`saga.compensations`) FROM Metric",
        {"operator": "ABOVE", "threshold": 3, "priority": "WARNING",
         "thresholdDuration": 900, "thresholdOccurrences": "AT_LEAST_ONCE"},
        janela=900,
    ),
] + [
    condicao(
        f"{servico} sem sinal",
        f"O {servico} parou de exportar o service.heartbeat: processo fora do ar "
        "ou sem conseguir falar com o New Relic.",
        "SELECT count(*) FROM Metric WHERE metricName = 'service.heartbeat' "
        f"AND service.name = '{servico}'",
        {"operator": "BELOW", "threshold": 1, "priority": "CRITICAL",
         "thresholdDuration": 300, "thresholdOccurrences": "ALL"},
        expiracao=300,
    )
    for servico in SERVICOS
]

variaveis = {f"c{i}": c for i, c in enumerate(condicoes)}
declaracoes = ", ".join(f"$c{i}: AlertsNrqlConditionStaticInput!" for i in range(len(condicoes)))
mutacoes = "\n".join(
    f"  c{i}: alertsNrqlConditionStaticCreate(accountId: {ACC}, policyId: \"{POLICY}\", "
    f"condition: $c{i}) {{ id name }}"
    for i in range(len(condicoes))
)
print(json.dumps(
    {"query": f"mutation({declaracoes}) {{\n{mutacoes}\n}}", "variables": variaveis},
    indent=2,
    ensure_ascii=False,
))
