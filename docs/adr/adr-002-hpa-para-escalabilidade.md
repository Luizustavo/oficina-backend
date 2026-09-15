# ADR-002 — HPA para escalabilidade horizontal

**Status:** Aceita · **Data:** 2026-09-13

## Contexto

A Fase 3 exige cluster Kubernetes **com escalabilidade**. A carga de uma oficina é irregular: concentra-se na abertura e no fim do expediente, e cai fora disso. Dimensionar para o pico desperdiça recurso o dia inteiro.

## Decisão

`HorizontalPodAutoscaler` de **2 a 6 réplicas**, escalando por CPU **e** memória a 70% de utilização.

```yaml
minReplicas: 2
maxReplicas: 6
metrics: [CPU 70%, memória 70%]
behavior:
  scaleUp:   { stabilizationWindowSeconds: 0 }
  scaleDown: { stabilizationWindowSeconds: 60 }
```

Exige o `metrics-server` instalado no cluster.

### As escolhas dentro da decisão

**`minReplicas: 2`, não 1.** Com uma réplica, todo rollout e todo reinício causam indisponibilidade. Duas é o mínimo para atualizar sem derrubar.

**CPU e memória, não só CPU.** A aplicação é Node.js com Prisma; sob carga de consulta, a memória sobe antes da CPU. Escalar só por CPU deixaria os pods sob pressão de memória sem reação.

**Subida imediata, descida com espera de 60s.** Assimetria proposital: chegar tarde na subida degrada o usuário; descer cedo demais causa oscilação, com pods subindo e descendo em ciclo.

**Máximo de 6.** Com `requests` de 250m de CPU e 256Mi por pod, seis réplicas já saturam a `t3.small`. Um teto maior seria ficção.

## Consequências

**Positivas**
- Absorve pico sem intervenção manual.
- Duas réplicas dão rollout sem downtime.
- É observável: CPU, memória e contagem de réplicas aparecem no New Relic, e o HPA escalando é demonstrável ao vivo.

**Negativas**
- **Escala pods, não nós.** Todos rodam na mesma EC2 ([ADR-001](adr-001-k3s-em-ec2-no-lugar-do-eks.md)); esgotada a máquina, o HPA fica com pods em `Pending`. A escalabilidade real termina no limite do nó.
- Depende do `metrics-server`; sem ele o HPA não coleta métrica e não faz nada — em silêncio.
- Não há Pod Disruption Budget, então uma drenagem do nó pode levar as duas réplicas ao mesmo tempo.

## Alternativas

**Escala vertical** — não dá rollout sem downtime e exige reinício para mudar limites.

**KEDA, escalando por fila ou métrica de negócio** — mais adequado a carga assíncrona. O sistema é síncrono e HTTP; CPU e memória são bons indicadores aqui.

**Cluster Autoscaler** — adicionaria nós, resolvendo o limite acima, mas exige EKS ou Auto Scaling Group gerenciado, o que recai no custo rejeitado na ADR-001.
