# Oficina — OS Service · Tech Challenge SOAT Fase 4

[![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=Luizustavo_oficina-backend&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=Luizustavo_oficina-backend) [![Cobertura](https://sonarcloud.io/api/project_badges/measure?project=Luizustavo_oficina-backend&metric=coverage)](https://sonarcloud.io/summary/new_code?id=Luizustavo_oficina-backend) [![CI](https://github.com/Luizustavo/oficina-backend/actions/workflows/ci.yml/badge.svg)](https://github.com/Luizustavo/oficina-backend/actions/workflows/ci.yml)

Sistema de gestão de ordens de serviço de uma oficina mecânica, dividido em **três microsserviços** que conversam por **RabbitMQ** numa **saga orquestrada**. Este repositório é o **OS Service**: ordem de serviço, clientes, veículos, catálogo e estoque, e o **orquestrador da saga**. NestJS, Prisma e PostgreSQL, em Clean Architecture + DDD.

| Repositório | Papel | Banco |
|---|---|---|
| **oficina-backend** (este) | **OS Service**: ordem de serviço, clientes, estoque; orquestra a saga. Também guarda a documentação da arquitetura (RFCs, ADRs, contratos) | PostgreSQL (`oficina_db`) |
| [oficina-billing-service](https://github.com/Luizustavo/oficina-billing-service) | **Billing Service**: orçamento, aprovação do cliente, pagamento pelo Mercado Pago e estorno | PostgreSQL (`billing_db`) + Redis |
| [oficina-execution-service](https://github.com/Luizustavo/oficina-execution-service) | **Execution Service**: fila de execução, diagnóstico e reparo | MongoDB |
| [oficina-lambda-auth](https://github.com/Luizustavo/oficina-lambda-auth) | Lambda de login por CPF (parte do OS Service, [ADR-014](docs/adr/adr-014-lambda-de-autenticacao-e-a-tabela-customers.md)) e API Gateway | — |
| [oficina-infra-k8s](https://github.com/Luizustavo/oficina-infra-k8s) | VPC, EC2 com k3s, ECR, Traefik, RabbitMQ | — |
| [oficina-infra-database](https://github.com/Luizustavo/oficina-infra-database) | RDS PostgreSQL | — |

Diagrama da arquitetura, fluxo da saga e compensações: [docs/arquitetura/diagrama-de-componentes.md](docs/arquitetura/diagrama-de-componentes.md).

## Ambiente

A infraestrutura é destruída ao final de cada sessão de trabalho para não consumir crédito ([ADR-001](docs/adr/adr-001-k3s-em-ec2-no-lugar-do-eks.md)); o [vídeo de demonstração](#vídeo-demonstrativo) mostra tudo no ar. O endereço do API Gateway muda a cada `apply`; com a infra provisionada:

```bash
terraform -chdir=infra output -raw api_gateway_url   # no repositório oficina-lambda-auth
```

| Recurso | Caminho no API Gateway |
|---|---|
| Swagger do OS Service | `/api/docs` |
| Swagger do Billing Service | `/api/billing/docs` |
| Swagger do Execution Service | `/api/execution/docs` |
| Healthchecks | `/api/health/live`, `/api/billing/health/live`, `/api/execution/health/live` |
| Painel no New Relic | [Oficina — Tech Challenge Fase 4](https://one.newrelic.com/dashboards/detail/ODUxNTY3NnxWSVp8REFTSEJPQVJEfGRhOjEzNTg0MTQ1) (página *Saga e microsserviços*) |
| Alertas | Políticas `Oficina — Tech Challenge Fase 3` e `Oficina — Tech Challenge Fase 4 (saga)` ([detalhes](docs/observabilidade.md)) |

---

## Saga Pattern

### O problema

Uma ordem de serviço atravessa os três serviços: o OS reserva as peças no banco dele, o Billing cobra no dele, o Execution enfileira o reparo no MongoDB. Como cada serviço tem o próprio banco, **não existe uma transação que cubra a OS inteira**: se o pagamento falhar depois de as peças serem reservadas, nenhum banco desfaz sozinho o que o outro já gravou.

### A solução

A saga divide a operação em **uma sequência de transações locais**, cada uma num serviço e no seu banco, ligadas por mensagens. Cada passo, ao terminar, avisa o próximo. Se um passo falha, a saga executa **compensações**: ações de negócio que desfazem o efeito dos passos já concluídos (devolver as peças, cancelar o orçamento, estornar o pagamento).

### Orquestrada, e não coreografada

| | Coreografada | **Orquestrada (a escolhida)** |
|---|---|---|
| Quem decide o próximo passo | Cada serviço, reagindo aos eventos dos outros | Um orquestrador central: o **OS Service** |
| Onde fica a regra do fluxo | Espalhada pelos serviços | Num lugar só, [`service-order-saga.ts`](src/application/saga/service-order-saga.ts), uma função pura testada sem infraestrutura |
| Estado da operação | Implícito, deduzido dos eventos | Gravado: passo atual, prazo e histórico (`saga_instances`, `saga_step_logs`), consultável em `GET /api/service-orders/:id/saga` |
| Acoplamento entre Billing e Execution | Precisam conhecer os eventos um do outro | Nenhum: cada um só responde aos comandos do OS |

**Por que orquestrada.** O fluxo da OS é **sequencial** (orçamento → aprovação → pagamento → execução) e **cada passo tem uma compensação diferente** (cancelar orçamento, devolver peças, estornar). Numa coreografia essa lógica ficaria distribuída e difícil de seguir; com um orquestrador, a regra fica num lugar só, os prazos são controlados por quem conhece o fluxo, e o suporte enxerga em que passo cada OS está. O custo, um ponto central de coordenação, é aceitável porque o OS já é o dono da ordem de serviço. Decisão completa na [ADR-011](docs/adr/adr-011-saga-orquestrada.md).

### Como funciona

O OS manda **comandos** pela exchange `saga.commands`; Billing e Execution respondem com **eventos** em `saga.events`. Contrato completo em [contratos-de-mensagens.md](docs/arquitetura/contratos-de-mensagens.md).

| Passo | Comando do OS | Evento de sucesso | Falha ou prazo vencido | Compensação |
|---|---|---|---|---|
| Gerar orçamento | `billing.budget.create` | `billing.budget.created` | `billing.budget.creation-failed` | OS volta para diagnóstico |
| Aprovação do cliente | — | `billing.budget.approved` (OS reserva as peças) | `billing.budget.rejected` ou prazo de aprovação | `billing.budget.cancel`; OS cancelada |
| Pagamento | — | `billing.payment.confirmed` | `billing.payment.failed` ou prazo de pagamento | `billing.budget.cancel`; peças devolvidas; OS cancelada |
| Execução | `execution.job.enqueue` | `execution.job.started` → `completed` | `execution.job.failed` | `billing.payment.refund` (estorno); peças devolvidas; OS cancelada |
| Cancelamento pela equipe | conforme o passo | — | — | cancela orçamento, job (`execution.job.cancel`) e estorna se já paga |

### O que garante que nada se perde

- **Outbox transacional**: a mensagem é gravada no mesmo commit da mudança de estado e publicada depois por um relay. Não existe "mudou o banco, mas a mensagem não saiu".
- **Consumo idempotente**: cada mensagem processada fica registrada pelo `messageId`; uma repetida é confirmada sem efeito.
- **Retentativa e fila de mortas**: falha transitória tenta de novo em 5 s, 30 s e 2 min; depois vai para a DLQ, gera alerta e pode ser reprocessada ([operação da mensageria](docs/arquitetura/operacao-da-mensageria.md)).
- **Prazos**: aprovação e pagamento têm prazo; vencido, a saga compensa sozinha.
- **Concorrência**: a saga é lida com trava (`SELECT … FOR UPDATE`), então dois eventos da mesma OS nunca são aplicados ao mesmo tempo.

Os sete cenários (caminho feliz, recusa, pagamento recusado, falha na execução, prazo vencido, serviço fora do ar, mensagem duplicada) rodam com `scripts/demo-saga.sh s1` … `s7`.

---

## Arquitetura

### Componentes da aplicação

**Clean Architecture + DDD**, com casos de uso divididos um por arquivo e mapeamento Entity ↔ DTO centralizado em classes estáticas por módulo.

```
src/
├── domain/                        # Regras de negócio puras — sem dependência de framework
│   ├── entities/                   # Customer, Vehicle, Service, Part, ServiceOrder, User
│   ├── repositories/                # Abstract classes usadas como token de DI (IXxxRepository)
│   ├── services/                    # Abstract classes para serviços externos (IEmailNotificationService)
│   ├── validators/value-objects/    # CPF, CNPJ, LicensePlate, ServiceOrderStatus
│   └── enums/
├── application/                   # Orquestração
│   ├── use-cases/                  # Um caso de uso por arquivo (create-part, approve-order, ...)
│   ├── dtos/                       # DTOs de request (class-validator) e response
│   └── mappers/                    # Entity ↔ DTO, um por entidade + PaginationMapper
├── infrastructure/
│   ├── database/prisma/             # Repositórios concretos + mappers Prisma ↔ Entity
│   ├── notification/                # ResendEmailNotificationService
│   ├── presentation/                # Controllers, Modules, Guards, Decorators, Filters
│   └── config/                      # JwtStrategy, jwtConfig, email.config
└── shared/
    └── exceptions/                 # Hierarquia de DomainException (mapeada para HTTP no filtro global)
```

### Infraestrutura provisionada

| Componente | Recurso | Função |
|---|---|---|
| Nó Kubernetes | EC2 `c7i-flex.large` rodando **k3s** | Os três serviços, o RabbitMQ, o MongoDB e o Redis, cada um no seu namespace |
| Entrada | API Gateway + Traefik (Ingress do k3s, porta 30080) | O gateway recebe tudo; o Traefik entrega `/api`, `/api/billing` e `/api/execution` ao serviço certo ([ADR-015](docs/adr/adr-015-traefik-como-ingress.md)) |
| Banco relacional | RDS PostgreSQL 16 | `oficina_db` (OS) e `billing_db` (Billing), um usuário por serviço, em subnet privada |
| Registro de imagens | ECR | Uma imagem por serviço, publicada pelo CD de cada um |
| Alerta de custo | AWS Budgets | Avisa por e-mail se o gasto do mês passar de 50%/100% do limite |

k3s (Kubernetes conformante) roda numa única EC2 em vez do EKS gerenciado, cujo control plane cobra taxa fixa por hora ([ADR-001](docs/adr/adr-001-k3s-em-ec2-no-lugar-do-eks.md)). Detalhes no repositório [`oficina-infra-k8s`](https://github.com/Luizustavo/oficina-infra-k8s).

### Fluxo de deploy

```
1. terraform apply (infra-k8s → database → lambda)  → VPC, EC2/k3s, RabbitMQ, RDS, Lambdas e API Gateway
2. Secrets aplicados uma vez por sessão (banco, JWT, RabbitMQ)
3. merge na main de um serviço → CI (lint, testes, SonarCloud, build) → CD:
   imagem no ECR → bootstrap do banco → migração → Deployment/Service/Ingress/HPA → rollout
```

Cada serviço tem o seu `cd-production.yml`; o do OS ainda roda o job que cria os usuários do banco (`os_user` e `auth_reader`).

### Camadas do OS Service

Como uma requisição atravessa as camadas, e onde cada regra mora:

```mermaid
flowchart TB
    REQ["Requisição HTTP<br/>vinda do API Gateway"]

    subgraph INFRA["infrastructure — moldura"]
        direction TB
        GUARD["Guards globais<br/>JwtAuthGuard · RolesGuard · CustomerScopeGuard"]
        CTRL["Controller<br/>+ ValidationPipe"]
        REPO["Repositório Prisma<br/>+ PrismaMapper"]
        FILTER["HttpExceptionFilter<br/>exceção de domínio → status HTTP"]
    end

    subgraph APP["application — orquestração"]
        UC["Caso de uso<br/>um por arquivo"]
        MAP["ApplicationMapper<br/>DTO ↔ Entidade"]
    end

    subgraph DOM["domain — regra de negócio pura"]
        ENT["Entidade rica<br/>ServiceOrder · Customer · Vehicle"]
        VO["Value objects<br/>CPF · CNPJ · Placa · StatusVO"]
        PORT["Portas abstratas<br/>IXxxRepository · IEmailNotificationService"]
    end

    DB[("PostgreSQL")]

    REQ --> GUARD --> CTRL --> UC
    UC --> PORT
    UC --> ENT
    ENT --> VO
    UC --> MAP
    PORT -.->|"implementada por"| REPO
    REPO --> DB
    UC -.->|"lança exceção de domínio"| FILTER
    FILTER --> REQ

    style DOM fill:#eef7ee,stroke:#4a4
    style APP fill:#eef2fa,stroke:#46a
    style INFRA fill:#faf6ee,stroke:#a84
```

A seta tracejada de `PORT` para `REPO` é a inversão de dependência: o domínio declara a porta como classe abstrata, e a infraestrutura a implementa. Nenhum arquivo em `domain/` importa NestJS ou Prisma.

Diagrama de componentes com a visão de nuvem, diagramas de sequência e o diagrama ER estão em [`docs/`](docs/README.md).

---

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Framework | NestJS 11 + TypeScript (strict) |
| ORM | Prisma 7 + `@prisma/adapter-pg` |
| Banco de Dados | PostgreSQL 16 (RDS em produção) |
| Autenticação | JWT (access token 15 min + refresh token 7 dias) |
| E-mail transacional | Resend |
| Orquestração | Kubernetes (k3s) |
| Infraestrutura como código | Terraform |
| CI/CD | GitHub Actions |
| Observabilidade | OpenTelemetry → New Relic (traces, métricas e logs) |
| Log estruturado | Pino (JSON, com correlação por trace) |
| Documentação | Swagger / OpenAPI |
| Testes | Jest (cobertura ≥ 80%) |

---

## Execução local

### 1. Instalar dependências

```bash
cd oficina-backend
npm install
```

### 2. Subir o banco de dados com Docker

```bash
docker compose up -d
```

Isso sobe dois contêineres:
- `oficina_postgres` — PostgreSQL 16 na porta **5432** (desenvolvimento)
- `oficina_postgres_test` — PostgreSQL 16 na porta **5433** (testes)

### 3. Configurar variáveis de ambiente

Confirme que o arquivo `.env` existe na raiz do projeto `oficina-backend/` (veja `.env.example` para o template completo, incluindo as chaves do Resend):

```env
DATABASE_URL="postgresql://oficina_user:oficina_pass@localhost:5432/oficina_db"
DATABASE_TEST_URL="postgresql://oficina_user:oficina_pass@localhost:5433/oficina_test_db"
JWT_SECRET="dev-jwt-secret-change-in-production"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_SECRET="dev-refresh-secret-change-in-production"
JWT_REFRESH_EXPIRES_IN="7d"
PORT=3000
NODE_ENV="development"
RESEND_API_KEY="re_your_resend_api_key"
EMAIL_FROM="onboarding@resend.dev"
```

### 4. Executar as migrations

```bash
npx prisma migrate deploy
```

### 5. Popular o banco com dados iniciais (seed)

```bash
npm run prisma:seed
```

Dados criados pelo seed:

| Tipo | Dados |
|---|---|
| Usuários | 3 (admin, mecânico, atendente) |
| Clientes | 2 (1 PF, 1 PJ) |
| Veículos | 3 |
| Serviços | 5 |
| Peças | 10 |

### 6. Iniciar o servidor

```bash
npm run start:dev
```

O servidor estará disponível em: **http://localhost:3000**

---

## Deploy em Kubernetes

Manifestos completos em [`/k8s`](k8s), com instruções passo a passo em [`k8s/README.md`](k8s/README.md): namespace, ConfigMap, Secret, Job de migração, Deployment, Service (`ClusterIP`), Ingress (rota `/api` no Traefik) e HorizontalPodAutoscaler.

Resumo rápido (pressupõe infraestrutura já provisionada — veja seção seguinte):

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
# preencha k8s/secret.yaml a partir do template k8s/secret.example.yaml e aplique
kubectl apply -f k8s/secret.yaml
# substitua o placeholder da imagem pela URL do ECR e aplique migration-job, deployment, service, hpa
```

## Provisionamento da infraestrutura (Terraform)

A infraestrutura **não mora mais neste repositório**. Desde a Fase 3 ela está dividida em repositórios próprios, cada um com o seu pipeline de CI/CD e o state remoto no S3:

| Repositório | O que provisiona |
|---|---|
| [`oficina-infra-k8s`](https://github.com/Luizustavo/oficina-infra-k8s) | VPC, subnets, EC2 com k3s, ECR e alerta de orçamento |
| [`oficina-infra-database`](https://github.com/Luizustavo/oficina-infra-database) | RDS PostgreSQL, subnet group e security group |
| [`oficina-lambda-auth`](https://github.com/Luizustavo/oficina-lambda-auth) | Lambda de autenticação por CPF e API Gateway |

A Lambda de autenticação por CPF faz parte do **OS Service**, implantada como função serverless ([ADR-014](docs/adr/adr-014-lambda-de-autenticacao-e-a-tabela-customers.md)): ela lê a tabela `customers` deste serviço, e os dois repositórios mudam juntos. Renomear `customers`, suas colunas `id`, `name`, `email`, `document`, ou mudar o formato do `document` (só dígitos) quebra o login por CPF.

**Ordem de apply:** `oficina-infra-k8s` → `oficina-infra-database` → `oficina-lambda-auth`. O repositório do banco lê a rede do primeiro via `terraform_remote_state`, então ele precisa existir antes.

**Ordem de destroy: exatamente a inversa.**

**Importante:** a infraestrutura é destruída ao final de cada sessão de trabalho para controlar custo — veja o checklist no README de cada repositório.

## CI/CD

`.github/workflows/ci.yml` roda lint, testes (unitário com cobertura mínima de 80%, integração e E2E), a análise do **SonarCloud com Quality Gate** e o build da imagem Docker em todo push/PR. `.github/workflows/cd-production.yml` faz o deploy de verdade depois de um CI verde na `main` (ou manualmente via **Actions → Deploy to Production → Run workflow**): publica a imagem no ECR, roda a migração e atualiza Deployment/Service/Ingress/HPA no cluster, descobrindo o nó k3s dinamicamente por tag, sem depender de IP fixo ou de state local do Terraform.

A `main` é protegida: só entra código por Pull Request com todos os checks verdes. A esteira é o modelo dos três microsserviços. Detalhes em [docs/arquitetura/esteira-ci-cd.md](docs/arquitetura/esteira-ci-cd.md).

---

## Modelagem de dados

PostgreSQL gerenciado (RDS). O domínio é relacional por natureza — cliente → veículo → ordem → itens — e aprovar um orçamento exige transação: muda status, congela o total e baixa estoque, tudo ou nada.

Na Fase 3 os itens da ordem deixaram de ser dois campos `Json` e viraram **tabelas de junção com chave estrangeira**:

```
service_orders ──< service_order_services >── services
               ──< service_order_parts    >── parts
```

O `Json` não dava integridade referencial (nada impedia apontar para um serviço inexistente, ou apagar do catálogo um serviço usado por dezenas de ordens), não permitia consulta analítica sobre os itens, e guardava dinheiro como ponto flutuante.

Preços e nomes continuam copiados na tabela de junção de propósito: é um instantâneo do catálogo no momento do orçamento. Reajustar um serviço não pode mudar o valor de uma ordem já aprovada.

📖 **Diagrama ER, explicação de cada relacionamento, justificativa do banco e detalhe dos índices em [`docs/modelagem-de-dados.md`](docs/modelagem-de-dados.md).**

---

## Observabilidade

Instrumentação com **OpenTelemetry**, exportando para o **New Relic**. Por ser padrão aberto, trocar de fornecedor é mudar duas variáveis de ambiente, sem alterar código instrumentado.

| Sinal | O que dá |
|---|---|
| Traces | Latência por rota e tempo de query no Postgres, automáticos |
| Logs JSON | `trace_id`, `span_id` e `requestId` em toda linha, com senha/token/CPF censurados |
| Métricas de negócio | Transições de ordem de serviço e tempo em cada status |
| Métricas de integração | Falhas e latência das chamadas externas |
| Infraestrutura | CPU e memória dos pods, via integração Kubernetes |
| **Trace distribuído (Fase 4)** | Uma requisição e as mensagens que ela gera viram **um trace só** atravessando OS, Billing e Execution pelo RabbitMQ: o contexto do trace é gravado no outbox e continuado no consumo |
| **Saga (Fase 4)** | Sagas iniciadas, compensações por motivo, como terminam e quanto duram; mensagens na DLQ; pagamentos; fila de execução; `sagaId` e `orderId` em todo log de mensagem |

Dos contadores de transição saem os três painéis exigidos pela Fase 3: volume diário de OS, tempo médio por status e erros de integração. Medir na transição, em vez de varrer a tabela na hora de montar o gráfico, é o que permite ver a oficina em tempo real.

Na Fase 4 o painel ganhou a página **Saga e microsserviços**, e a política de alertas da saga avisa quando uma mensagem cai na DLQ, quando as compensações passam do normal e quando um serviço para de dar sinal de vida.

📖 **Consultas NRQL prontas dos dashboards, alertas e passo a passo de configuração em [`docs/observabilidade.md`](docs/observabilidade.md).**

---

## Documentação da arquitetura

| Documento | Conteúdo |
|---|---|
| [Diagrama de componentes](docs/arquitetura/diagrama-de-componentes.md) | Arquitetura da Fase 4: os três serviços, bancos, RabbitMQ, fluxo da saga e compensações |
| [Contratos de mensagens](docs/arquitetura/contratos-de-mensagens.md) | Envelope, topologia do RabbitMQ, comandos e eventos da saga |
| [Operação da mensageria](docs/arquitetura/operacao-da-mensageria.md) | DLQ, reprocessamento e os cenários S1–S7 |
| [Esteira de CI/CD](docs/arquitetura/esteira-ci-cd.md) | O pipeline comum aos três serviços e a proteção da `main` |
| [Subir e derrubar o ambiente](docs/arquitetura/subida-do-ambiente.md) | A ordem completa entre os seis repositórios, os Secrets de cada serviço e as pegadinhas |
| [Diagramas de sequência](docs/arquitetura/diagramas-de-sequencia.md) | Autenticação por CPF, abertura de ordem, transição de status e máquina de estados |
| [Modelagem de dados](docs/modelagem-de-dados.md) | Diagrama ER, relacionamentos, justificativa do banco e índices |
| [Observabilidade](docs/observabilidade.md) | Instrumentação, consultas NRQL dos dashboards e alertas |
| [RFCs](docs/rfc/) | Escolha da nuvem, do banco e da estratégia de autenticação |
| [ADRs](docs/adr/) | Quinze decisões arquiteturais; as da Fase 4 vão da [ADR-009](docs/adr/adr-009-divisao-em-microsservicos.md) (divisão em microsserviços) à [ADR-015](docs/adr/adr-015-traefik-como-ingress.md) |

Índice completo em [`docs/`](docs/README.md).

---

## Documentação da API

- **Collection completa (OpenAPI, importável no Postman/Insomnia)**: [`docs/openapi.json`](docs/openapi.json) — veja [`docs/openapi.md`](docs/openapi.md) para instruções de importação. Versionada no repositório, não depende da infraestrutura estar no ar.
- **Swagger ao vivo**: `/api/docs` no API Gateway, enquanto a infraestrutura estiver provisionada (ver [Ambiente](#ambiente)). Billing e Execution têm o seu em `/api/billing/docs` e `/api/execution/docs`.
- **Swagger local**: http://localhost:3000/api/docs (com `npm run start:dev`)

## Vídeo demonstrativo

**Fase 4:** https://youtu.be/XHv-UubNEV8 — fluxo completo de uma OS pelos três serviços, a saga com falhas e compensações, deploy automatizado com validação de testes, e o rastreamento distribuído no New Relic.

---

## Credenciais de acesso (seed)

| Email | Senha | Papel |
|---|---|---|
| `admin@oficina.com` | `Admin123!` | Administrador |
| `mechanic@oficina.com` | `Mech123!` | Mecânico |
| `attendant@oficina.com` | `Att123!` | Atendente |

### Exemplo de login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@oficina.com","password":"Admin123!"}'
```

Resposta:
```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "user": { "id": "...", "name": "Admin", "email": "admin@oficina.com", "role": "ADMIN" }
}
```

Inclua o `accessToken` no cabeçalho das demais requisições:
```
Authorization: Bearer <accessToken>
```

---

## Testes

```bash
# Rodar todos os testes
npm test

# Rodar com cobertura
npm test -- --coverage

# Rodar um arquivo específico
npm test -- --testPathPattern=customer
```

Cobertura (mínimo de 80%, verificado no CI e no Quality Gate do [SonarCloud](https://sonarcloud.io/summary/new_code?id=Luizustavo_oficina-backend)):

| Métrica | Cobertura |
|---|---|
| Statements | 86,9% |
| Branches | 90,2% |
| Functions | 87,2% |
| Lines | 86,9% |

Além dos unitários: `npm run test:int` (Postgres e RabbitMQ de verdade, incluindo a saga e a trava de concorrência) e `npm run test:e2e`.

---

## Fluxo de uma Ordem de Serviço

```
RECEIVED → IN_DIAGNOSIS → AWAITING_APPROVAL → AWAITING_PAYMENT → PAID → IN_PROGRESS → COMPLETED → DELIVERED
                ▲                │
                └────────────────┘ compensação: o Billing não conseguiu gerar o orçamento

CANCELED: de qualquer estado anterior a COMPLETED
```

Na Fase 4 a OS segue a **saga orquestrada** da ADR-011. A equipe conduz a OS até o pedido de aprovação; dali em diante, quem avança a OS são os eventos dos outros serviços:

| Quem | O que faz | Status da OS |
|---|---|---|
| Equipe | `PATCH /service-orders/:id/request-approval`: inicia a saga e pede o orçamento ao Billing | `AWAITING_APPROVAL` |
| Billing Service | Cliente aprova o orçamento (`billing.budget.approved`); as peças são reservadas no estoque | `AWAITING_PAYMENT` |
| Billing Service | Mercado Pago confirma o pagamento (`billing.payment.confirmed`); o OS manda o job para o Execution | `PAID` |
| Execution Service | Mecânico começa e termina o reparo (`execution.job.started` / `completed`) | `IN_PROGRESS` → `COMPLETED` |
| Equipe | `PATCH /service-orders/:id/deliver` | `DELIVERED` |

Se algo falhar (orçamento recusado, pagamento recusado ou vencido, falha na execução), a saga compensa sozinha: cancela o orçamento, devolve as peças ao estoque e, se a OS já foi paga, pede o estorno. O cancelamento pela equipe (`PATCH /service-orders/:id/cancel`) também passa pela saga. As rotas de aprovação e de conclusão da Fase 3 (`/approve`, `/complete` e `/track/:orderNumber/budget-decision`) foram removidas: a aprovação acontece no Billing e a conclusão vem do Execution.

Aprovação e pagamento têm prazo (`SAGA_APPROVAL_TIMEOUT_SECONDS` e `SAGA_PAYMENT_TIMEOUT_SECONDS`, no ConfigMap): vencido o prazo, a saga compensa sozinha. Para ver em que passo a saga de uma OS está, com o histórico de todos os eventos, use `GET /service-orders/:id/saga`.

Para demonstrar a saga de ponta a ponta (caminho feliz e cada compensação, cenários S1 a S7) há o `scripts/demo-saga.sh`, que roda contra o API Gateway. Como usá-lo, e como acompanhar e reprocessar mensagens que caem numa DLQ, está em [docs/arquitetura/operacao-da-mensageria.md](docs/arquitetura/operacao-da-mensageria.md).

A cada transição, o cliente recebe um e-mail automático, enviado para o e-mail gravado na OS no momento da abertura.

---

## Fluxo completo em BDD

O fluxo completo da OS está descrito em Gherkin, em português, em [`test/bdd/features/fluxo-completo-da-os.feature`](test/bdd/features/fluxo-completo-da-os.feature), e roda com `npm run test:bdd` (`jest-cucumber`) e no job `BDD` do CI. São dois cenários: o caminho feliz, da abertura à entrega, e a falha na execução depois do pagamento, com estorno e peças de volta ao estoque.

A aplicação sobe inteira contra o Postgres: as ações da equipe vão pela API HTTP, com token de verdade, e as respostas do Billing e do Execution entram pelo consumidor real da fila `os.saga-events`, como chegariam pelo RabbitMQ. Os comandos que a saga envia são conferidos no outbox.

```gherkin
Cenário: Caminho feliz, da abertura à entrega
  Dado um cliente com um veículo e a peça "Filtro de óleo" com 10 unidades em estoque
  E uma OS aberta com um serviço e 2 peças, já em diagnóstico
  Quando a equipe pede a aprovação do orçamento
  Então a OS fica "AWAITING_APPROVAL"
  E o comando "billing.budget.create" é enviado
  Quando o Billing informa "billing.budget.created"
  E o Billing informa "billing.budget.approved"
  Então a OS fica "AWAITING_PAYMENT"
  E o estoque da peça fica em 8
  …
  Quando a equipe entrega o veículo
  Então a OS fica "DELIVERED"
```

---

## Análise de Qualidade e Segurança (SonarQube)

No CI, a análise roda no **SonarCloud** a cada Pull Request (job `Quality (SonarCloud)`), e um Quality Gate reprovado bloqueia o merge. Veja [docs/arquitetura/esteira-ci-cd.md](docs/arquitetura/esteira-ci-cd.md).

Para rodar a mesma análise localmente, o projeto inclui configuração pronta para o SonarQube Community via Docker.

### 1. Gerar relatório de cobertura

```bash
npm run test:cov
```

Isso gera `coverage/lcov.info`, que será enviado ao SonarQube.

### 2. Subir o SonarQube

```bash
docker compose -f docker-compose.sonar.yml up -d sonarqube sonar_postgres
```

Aguarde ~2 minutos e acesse **http://localhost:9000** (login padrão: `admin` / `admin`).

### 3. Gerar o token de autenticação

No painel: **My Account → Security → Generate Token**

Adicione ao `.env`:
```env
SONAR_TOKEN="seu-token-aqui"
```

### 4. Executar o scanner

```bash
docker compose -f docker-compose.sonar.yml run --rm sonar_scanner
```

O relatório estará disponível em **http://localhost:9000/dashboard?id=oficina-backend**.

### 5. Encerrar o ambiente

```bash
docker compose -f docker-compose.sonar.yml down
```

---

  
