# RFC-001 — Escolha do provedor de nuvem

| | |
|---|---|
| **Status** | Aceita |
| **Data** | 2026-09-13 |
| **Decisão** | Amazon Web Services, região `sa-east-1` |

---

## Contexto

A Fase 3 exige API Gateway, função serverless, banco gerenciado, cluster Kubernetes e provisionamento por Terraform. A escolha da nuvem é livre.

Duas restrições pesam mais que as outras:

1. **Orçamento real de US$ 120 em créditos**, sem cartão de crédito de reserva. Uma escolha que gere custo fixo por hora consome o saldo mesmo com o sistema ocioso.
2. **Latência e conformidade no Brasil.** Os dados incluem CPF, que é dado pessoal sob a LGPD. Manter o processamento em território nacional simplifica o enquadramento e reduz latência para o usuário final.

## Opções consideradas

### A. AWS

- Todos os cinco componentes exigidos existem como serviço de primeira classe.
- Região `sa-east-1` (São Paulo) atende a restrição de território.
- Free tier de conta nova cobre EC2 `t3.micro`, RDS `db.t4g.micro` (750h/mês) e 1 milhão de invocações de Lambda por mês.
- É a nuvem com mais material de referência e com o provider Terraform mais maduro.
- **Contra:** o control plane do EKS custa US$ 0,10/hora sem free tier — US$ 72/mês só para existir. Inviável com o orçamento (ver [ADR-001](../adr/adr-001-k3s-em-ec2-no-lugar-do-eks.md), que resolve isso).

### B. Google Cloud

- O GKE Autopilot é operacionalmente mais simples que o EKS, e o control plane de um cluster zonal é gratuito.
- Cloud Run seria um encaixe ainda melhor que Kubernetes para esta carga.
- **Contra:** a região `southamerica-east1` tem preço acima da média e menos serviços disponíveis. O Cloud SQL não tem equivalente ao free tier de 750h do RDS.
- **Contra decisivo:** o enunciado pede explicitamente *cluster Kubernetes*; o Autopilot esconde os nós, o que atrapalharia demonstrar o HPA escalando, que é parte da entrega.

### C. Azure

- O control plane do AKS é gratuito no tier Free, o que resolveria o problema de custo do EKS.
- **Contra:** a região `brazilsouth` tem oferta menor. O Azure Database for PostgreSQL não tem free tier permanente comparável.
- **Contra:** menor familiaridade da equipe, o que em um projeto com prazo fixo é um risco de cronograma, não uma preferência.

## Decisão

**AWS, região `sa-east-1`.**

O fator determinante não foi capacidade técnica — as três atendem o enunciado. Foi a combinação de free tier aplicável a EC2 e RDS, maturidade do provider Terraform e familiaridade da equipe, que reduz o risco de cronograma.

O único ponto fraco da AWS neste recorte — o custo do control plane do EKS — é contornável trocando EKS por k3s numa EC2, decisão tratada separadamente na [ADR-001](../adr/adr-001-k3s-em-ec2-no-lugar-do-eks.md).

## Consequências

**Positivas**
- Custo de operação próximo de zero dentro do free tier.
- Os cinco componentes exigidos provisionados por um único provider Terraform.
- Acesso administrativo por SSM, sem chave SSH e sem porta 22 exposta.

**Negativas**
- Acoplamento a serviços proprietários da AWS: API Gateway, Lambda, RDS e ECR não são portáveis sem reescrita. A aplicação em si permanece portável (container, Postgres padrão, OpenTelemetry).
- `sa-east-1` é uma das regiões mais caras da AWS. Fora do free tier, o mesmo desenho custaria mais que em `us-east-1`.
- Trocar de nuvem depois exigiria reescrever os três repositórios de infraestrutura, embora nenhum código de aplicação.

## Mitigação do aprisionamento

Onde foi barato manter portabilidade, mantivemos:

- A aplicação é um container executando Kubernetes conformante — roda em qualquer nuvem.
- O banco é PostgreSQL padrão, sem extensão proprietária.
- A observabilidade usa OpenTelemetry, não o agente da nuvem ([ADR-007](../adr/adr-007-opentelemetry-no-lugar-de-agente-proprietario.md)).

O que está de fato preso à AWS é a camada de entrada (API Gateway + Lambda) e o IaC. Foi um custo aceito conscientemente.
