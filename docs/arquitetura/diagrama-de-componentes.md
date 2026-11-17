# Diagrama de Componentes

Arquitetura final da Fase 4: três microsserviços, cada um com o próprio banco, conversando por RabbitMQ numa saga orquestrada, atrás de um API Gateway. As decisões estão nas ADRs 009 a 015.

---

## Visão geral

```mermaid
flowchart TB
    CLI["Cliente da oficina<br/>autentica por CPF"]
    FUNC["Equipe<br/>ADMIN · MECHANIC · ATTENDANT"]
    MP["Mercado Pago<br/>Checkout Pro · pagamentos · estornos"]

    subgraph AWS["AWS · sa-east-1"]
        direction TB
        APIGW["API Gateway HTTP API<br/>única porta pública"]
        LAUTHZ["Lambda authorizer<br/>verifica o JWT na borda"]

        subgraph VPC["VPC · sem NAT Gateway"]
            direction TB
            LAUTH["Lambda auth-cpf<br/>valida CPF e emite JWT<br/>(parte do OS Service, ADR-014)"]

            subgraph K3S["EC2 c7i-flex.large · k3s"]
                direction TB
                TRAEFIK["Traefik (Ingress)<br/>NodePort 30080<br/>roteia por prefixo"]

                subgraph NSOS["namespace oficina"]
                    OS["OS Service<br/>NestJS · /api<br/>ordem, cliente, estoque<br/>orquestra a saga"]
                end
                subgraph NSBILL["namespace billing"]
                    BILL["Billing Service<br/>NestJS · /api/billing<br/>orçamento e pagamento"]
                    REDIS[("Redis<br/>idempotência do webhook<br/>trava por OS")]
                end
                subgraph NSEXEC["namespace execution"]
                    EXEC["Execution Service<br/>NestJS · /api/execution<br/>fila de diagnóstico e reparo"]
                    MONGO[("MongoDB 8<br/>execution_db")]
                end
                subgraph NSMQ["namespace messaging"]
                    MQ{{"RabbitMQ 4.1<br/>saga.commands · saga.events<br/>filas com retentativa e DLQ"}}
                end
            end

            subgraph RDS["RDS PostgreSQL 16 · subnet privada"]
                DBOS[("oficina_db<br/>os_user · auth_reader")]
                DBBILL[("billing_db<br/>billing_user")]
            end
        end
        ECR["ECR<br/>uma imagem por serviço"]
    end

    NR["New Relic<br/>traces · métricas · logs (OTLP)"]
    RESEND["Resend<br/>e-mail ao cliente"]

    CLI -->|"POST /auth/cpf"| APIGW
    CLI -->|"Bearer JWT"| APIGW
    FUNC -->|"Bearer JWT"| APIGW
    MP -->|"webhook (rota pública,<br/>assinatura x-signature)"| APIGW

    APIGW --> LAUTH
    APIGW -.->|"rotas protegidas"| LAUTHZ
    APIGW -->|"HTTP :30080"| TRAEFIK

    TRAEFIK -->|"/api"| OS
    TRAEFIK -->|"/api/billing"| BILL
    TRAEFIK -->|"/api/execution"| EXEC

    LAUTH -->|"SELECT 4 colunas<br/>de customers"| DBOS
    OS --> DBOS
    BILL --> DBBILL
    BILL --> REDIS
    EXEC --> MONGO

    OS <-->|"comandos / eventos"| MQ
    BILL <-->|"comandos / eventos"| MQ
    EXEC <-->|"comandos / eventos"| MQ

    BILL -->|"cria checkout, consulta pagamento, estorna"| MP
    OS --> RESEND
    OS -.-> NR
    BILL -.-> NR
    EXEC -.-> NR

    style MQ fill:#fff4e5,stroke:#f59e0b
    style APIGW fill:#fff4e5,stroke:#f59e0b
    style DBOS fill:#e8f0fe,stroke:#4285f4
    style DBBILL fill:#e8f0fe,stroke:#4285f4
    style MONGO fill:#e6f4ea,stroke:#34a853
    style REDIS fill:#fce8e6,stroke:#ea4335
```

**Nenhum serviço acessa o banco de outro, e o próprio banco garante isso:** cada serviço tem um usuário que só conecta no próprio database (o `CONNECT` do `PUBLIC` é revogado), e o MongoDB e o Redis só existem no namespace do serviço dono. A Lambda de CPF lê `customers` porque faz parte da fronteira do OS Service ([ADR-014](../adr/adr-014-lambda-de-autenticacao-e-a-tabela-customers.md)), com um usuário que só enxerga quatro colunas.

---

## Comunicação e fluxo da saga

Os serviços só conversam por mensagens. O **OS Service orquestra** ([ADR-011](../adr/adr-011-saga-orquestrada.md)): manda **comandos** para a exchange `saga.commands` e reage aos **eventos** que os outros publicam em `saga.events`. Billing e Execution não se conhecem.

```mermaid
flowchart LR
    OS["OS Service<br/>(orquestrador)"]

    subgraph MQ["RabbitMQ"]
        CMD{{"saga.commands<br/>(topic)"}}
        EVT{{"saga.events<br/>(topic)"}}
        QB[("billing.commands")]
        QE[("execution.commands")]
        QO[("os.saga-events")]
    end

    BILL["Billing Service"]
    EXEC["Execution Service"]

    OS -->|"billing.budget.create · cancel<br/>billing.payment.refund<br/>execution.job.enqueue · cancel"| CMD
    CMD -->|"billing.#"| QB --> BILL
    CMD -->|"execution.#"| QE --> EXEC
    BILL -->|"billing.budget.created · approved · rejected<br/>billing.payment.confirmed · failed · refunded"| EVT
    EXEC -->|"execution.job.queued · started<br/>completed · failed · canceled"| EVT
    EVT -->|"billing.# · execution.#"| QO --> OS
```

Cada fila tem três filas de espera (5 s, 30 s, 2 min) e uma DLQ. Toda mensagem sai por um **outbox transacional** (gravada junto com a mudança de estado) e é consumida de forma **idempotente**. Contrato completo em [contratos-de-mensagens.md](contratos-de-mensagens.md).

**O fluxo de uma OS:**

| # | Quem age | O que acontece | Status da OS |
|---|---|---|---|
| 1 | Equipe → OS | Abre a OS, faz o diagnóstico, adiciona serviços e peças | `RECEIVED` → `IN_DIAGNOSIS` |
| 2 | Equipe → OS | Pede a aprovação: a saga começa, `billing.budget.create` | `AWAITING_APPROVAL` |
| 3 | Billing | Gera o orçamento, `billing.budget.created` | |
| 4 | Cliente → Billing | Aprova (token da Lambda de CPF); o Billing cria o checkout no Mercado Pago; `billing.budget.approved`; o OS reserva as peças | `AWAITING_PAYMENT` |
| 5 | Mercado Pago → Billing | Webhook do pagamento aprovado, `billing.payment.confirmed`; o OS manda `execution.job.enqueue` | `PAID` |
| 6 | Mecânico → Execution | Diagnóstico, reparo e conclusão; `execution.job.started` e `completed` | `IN_PROGRESS` → `COMPLETED` |
| 7 | Equipe → OS | Entrega ao cliente | `DELIVERED` |

**Compensações** (a saga desfaz o que já foi feito, conforme o passo):

| Falha | Compensação |
|---|---|
| Orçamento não pôde ser gerado | OS volta para diagnóstico |
| Cliente recusa, ou o prazo de aprovação vence | `billing.budget.cancel`; OS cancelada |
| Pagamento recusado, ou o prazo de pagamento vence | `billing.budget.cancel` (expira o checkout); peças devolvidas; OS cancelada |
| Falha na execução (`/fail` do mecânico) | `billing.payment.refund` (estorno no Mercado Pago); peças devolvidas; OS cancelada |
| Cancelamento pela equipe | Conforme o passo: cancela o orçamento, o job (`execution.job.cancel`) e estorna se já estava paga |

Diagramas de sequência do caminho feliz e das compensações em [diagramas-de-sequencia.md](diagramas-de-sequencia.md) e [contratos-de-mensagens.md](contratos-de-mensagens.md).

---

## Componentes

| Componente | Tecnologia | Responsabilidade | Decisão |
|---|---|---|---|
| **API Gateway** | AWS HTTP API | Única porta pública: roteia, aplica throttling, rotas públicas (CPF, health, docs, webhook) e as protegidas pelo authorizer | — |
| **Lambda authorizer** | Node.js, fora da VPC | Verifica o JWT HS256 na borda, decisão cacheada 5 min | — |
| **Lambda auth-cpf** | Node.js, na VPC | Valida o CPF, consulta o cliente e emite o JWT | [ADR-014](../adr/adr-014-lambda-de-autenticacao-e-a-tabela-customers.md) |
| **Traefik** | Ingress do k3s, NodePort 30080 | Roteia `/api`, `/api/billing` e `/api/execution` para o serviço certo | [ADR-015](../adr/adr-015-traefik-como-ingress.md) |
| **OS Service** | NestJS + Prisma, PostgreSQL | Ordem de serviço, clientes, veículos, catálogo e estoque; **orquestra a saga** (estado, prazos, compensações) | [ADR-009](../adr/adr-009-divisao-em-microsservicos.md), [ADR-011](../adr/adr-011-saga-orquestrada.md) |
| **Billing Service** | NestJS + Prisma, PostgreSQL + Redis | Orçamento, aprovação do cliente, Checkout Pro do Mercado Pago, webhook e estorno | [ADR-013](../adr/adr-013-redis-com-dono-unico.md) |
| **Execution Service** | NestJS + Mongoose, MongoDB | Fila de execução, diagnóstico e reparo, com linha do tempo do job | [ADR-012](../adr/adr-012-mongodb-no-execution-service.md) |
| **RabbitMQ** | 4.1, filas quorum | Comandos e eventos da saga, retentativa e DLQ | [ADR-010](../adr/adr-010-mensageria-com-rabbitmq.md) |
| **RDS PostgreSQL 16** | subnet privada | `oficina_db` (OS) e `billing_db` (Billing), um usuário por serviço | [RFC-002](../rfc/rfc-002-escolha-do-banco-de-dados.md) |
| **New Relic** | OpenTelemetry (OTLP) | Traces que atravessam o RabbitMQ, métricas da saga, logs com `sagaId`/`orderId`, painel e alertas | [observabilidade.md](../observabilidade.md) |

Cada serviço escala sozinho pelo HPA: OS de 1 a 3 réplicas, Billing e Execution de 1 a 2.

---

## Entrega

Seis repositórios, cada um com o seu pipeline. Os três de infraestrutura compartilham o state no S3; os três serviços seguem a mesma esteira: lint, testes unitários com cobertura mínima de 80%, testes de integração e E2E, Quality Gate do SonarCloud, build da imagem e, depois do merge na `main`, deploy automático no k3s ([esteira-ci-cd.md](esteira-ci-cd.md)).

```mermaid
flowchart LR
    R1["oficina-infra-k8s<br/>VPC · EC2/k3s · ECR<br/>RabbitMQ e namespaces"] -->|"outputs via<br/>terraform_remote_state"| R2["oficina-infra-database<br/>RDS"]
    R1 --> R3["oficina-lambda-auth<br/>Lambdas · API Gateway"]
    R2 --> R3

    S1["oficina-backend<br/>OS Service"] -.->|"imagem no ECR<br/>kubectl via SSM"| R1
    S2["oficina-billing-service"] -.-> R1
    S3["oficina-execution-service"] -.-> R1

    ST[("S3<br/>state remoto")]
    R1 --- ST
    R2 --- ST
    R3 --- ST
```

**Ordem de apply:** `k8s` → `database` → `lambda`, e depois os deploys dos serviços. **Ordem de destroy:** exatamente a inversa.

---

## Fronteiras de segurança

```mermaid
flowchart TB
    NET["Internet"] -->|"443"| GW["API Gateway<br/>única porta pública"]
    GW -->|"token verificado na borda"| APP["Serviços no k3s"]
    APP -->|"SG do nó · um usuário por serviço"| DB[("RDS<br/>subnet privada")]
    LMB["Lambda auth-cpf<br/>na VPC"] -->|"SG da Lambda · auth_reader"| DB

    NET -.->|"bloqueado"| DB

    style DB fill:#e8f0fe,stroke:#4285f4
    style GW fill:#fff4e5,stroke:#f59e0b
```

- O banco **não** tem endereço público. Só os security groups do nó e da Lambda alcançam a porta 5432.
- RabbitMQ, MongoDB e Redis só existem dentro do cluster (`ClusterIP`), sem rota pela internet.
- Cada serviço valida o JWT de novo, e o cliente é **negado por padrão**: só entra nas rotas marcadas para ele, e só nos próprios dados.
- O acesso ao nó é por **AWS Systems Manager**, sem chave SSH e sem porta 22 aberta.
- Segredos do cluster vivem em `Secret` do Kubernetes; os da Lambda, em variável de ambiente criptografada com KMS ([ADR-004](../adr/adr-004-segredos-em-variavel-de-ambiente-na-lambda.md)). Em produção, um serviço sem `JWT_SECRET` se recusa a subir.
- Senha, token, CPF e documento são censurados nos logs antes de saírem do cluster.

### Limitação conhecida

A porta **30080** do Traefik, num nó com IP elástico público, **é alcançável pela internet**, contornando o API Gateway. Num desenho de produção isso se resolve com o security group do nó aceitando tráfego apenas dos ranges do API Gateway, ou com um Network Load Balancer interno. Está documentado aqui por ser uma consequência direta da escolha de custo do [ADR-001](../adr/adr-001-k3s-em-ec2-no-lugar-do-eks.md), e não um descuido.
