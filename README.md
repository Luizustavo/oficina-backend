# Oficina Backend — Tech Challenge SOAT Fase 3

Sistema de gerenciamento de ordens de serviço para uma oficina mecânica, desenvolvido com **NestJS**, **Prisma**, **PostgreSQL** e arquitetura **Clean Architecture + DDD**.

Este é o repositório da **aplicação**. A infraestrutura vive em três repositórios próprios, cada um com o seu CI/CD:

| Repositório | Conteúdo |
|---|---|
| **oficina-backend** (este) | Aplicação NestJS, manifestos Kubernetes, documentação arquitetural |
| [oficina-infra-k8s](https://github.com/Luizustavo/oficina-infra-k8s) | VPC, EC2 com k3s, ECR, alerta de orçamento |
| [oficina-infra-database](https://github.com/Luizustavo/oficina-infra-database) | RDS PostgreSQL |
| [oficina-lambda-auth](https://github.com/Luizustavo/oficina-lambda-auth) | Lambda de autenticação por CPF e API Gateway |

## Deploy ativo

| Recurso | Endereço |
|---|---|
| **API (porta de entrada)** | `https://dzsca8yk0b.execute-api.sa-east-1.amazonaws.com` — a raiz responde **401** de propósito: toda rota não pública exige token, barrado já no API Gateway |
| **Swagger** | https://dzsca8yk0b.execute-api.sa-east-1.amazonaws.com/api/docs |
| **OpenAPI (JSON)** | https://dzsca8yk0b.execute-api.sa-east-1.amazonaws.com/api/docs-json |
| **Healthcheck** | https://dzsca8yk0b.execute-api.sa-east-1.amazonaws.com/api/health/live |
| **Dashboards** | [New Relic — Tech Challenge Fase 3](https://one.newrelic.com/dashboards/detail/ODUxNTY3NnxWSVp8REFTSEJPQVJEfGRhOjEzMTc2NzI5) — 20 widgets em 2 páginas |
| **Alertas** | Política `Oficina — Tech Challenge Fase 3`, 5 condições ativas ([detalhes](docs/observabilidade.md#alertas)) |

> A infraestrutura é destruída ao final de cada sessão de trabalho para não consumir crédito (ver [ADR-001](docs/adr/adr-001-k3s-em-ec2-no-lugar-do-eks.md)). Enquanto estiver fora, os endereços acima não respondem, e o identificador do API Gateway muda a cada novo `apply`. Para obter o endereço atual:
>
> ```bash
> terraform -chdir=infra output -raw api_gateway_url   # no repositório oficina-lambda-auth
> ```
>
> O vídeo de demonstração mostra o ambiente no ar.

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

| Componente | Recurso AWS | Função |
|---|---|---|
| Nó Kubernetes | EC2 t3.small rodando **k3s** | Roda os pods da aplicação (Deployment, Service, HPA) |
| Banco de dados | RDS PostgreSQL (`db.t4g.micro`) | Persistência, em subnet privada, acesso só do nó k3s |
| Registro de imagens | ECR | Guarda a imagem Docker publicada pelo CI/CD |
| Alerta de custo | AWS Budgets | Avisa por e-mail se o gasto do mês passar de 50%/100% do limite |

k3s (Kubernetes leve, mas 100% real) roda numa única EC2 em vez de usar EKS gerenciado — o control plane do EKS cobra taxa fixa por hora sem free tier, enquanto a EC2 e o RDS escolhidos são elegíveis ao free tier de conta nova. Isso mantém o custo em ~US$0,04–0,07/hora em vez de ~US$0,37/hora. Detalhes e justificativa completa no repositório [`oficina-infra-k8s`](https://github.com/Luizustavo/oficina-infra-k8s).

### Fluxo de deploy

```
1. terraform apply     → provisiona VPC, EC2 (k3s), RDS, ECR, alerta de orçamento
2. docker build/push   → imagem da API publicada no ECR
3. kubectl apply        → namespace, ConfigMap e Secret (uma vez, manual)
4. Job de migração      → prisma migrate deploy contra o RDS
5. Deployment/Service/HPA → aplicação no ar, escalando de 2 a 6 réplicas
```

Os passos 2–5 são automatizados pelo pipeline de CI/CD (`.github/workflows/cd-production.yml`) a cada push em `main`.

### Diagrama da arquitetura

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

Manifestos completos em [`/k8s`](k8s), com instruções passo a passo em [`k8s/README.md`](k8s/README.md): namespace, ConfigMap, Secret, Job de migração, Deployment, Service (`NodePort`) e HorizontalPodAutoscaler.

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

**Ordem de apply:** `oficina-infra-k8s` → `oficina-infra-database` → `oficina-lambda-auth`. O repositório do banco lê a rede do primeiro via `terraform_remote_state`, então ele precisa existir antes.

**Ordem de destroy: exatamente a inversa.**

**Importante:** a infraestrutura é destruída ao final de cada sessão de trabalho para controlar custo — veja o checklist no README de cada repositório.

## CI/CD

`.github/workflows/ci.yml` builda, testa (unitário/integração/e2e) e valida a imagem Docker em todo push/PR. `.github/workflows/cd-production.yml` faz o deploy de verdade em push para `main` (ou manualmente via **Actions → Deploy to Production → Run workflow**): publica a imagem no ECR, roda a migração e atualiza Deployment/Service/HPA no cluster — descobrindo o nó k3s dinamicamente por tag, sem depender de IP fixo ou de state local do Terraform.

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

Dos contadores de transição saem os três painéis exigidos pela Fase 3: volume diário de OS, tempo médio por status e erros de integração. Medir na transição, em vez de varrer a tabela na hora de montar o gráfico, é o que permite ver a oficina em tempo real.

📖 **Consultas NRQL prontas dos dashboards, alertas e passo a passo de configuração em [`docs/observabilidade.md`](docs/observabilidade.md).**

---

## Documentação da arquitetura

| Documento | Conteúdo |
|---|---|
| [Diagrama de componentes](docs/arquitetura/diagrama-de-componentes.md) | Visão de nuvem: entrada, computação, dados, observabilidade e entrega |
| [Diagramas de sequência](docs/arquitetura/diagramas-de-sequencia.md) | Autenticação por CPF, abertura de ordem, transição de status e máquina de estados |
| [Modelagem de dados](docs/modelagem-de-dados.md) | Diagrama ER, relacionamentos, justificativa do banco e índices |
| [Observabilidade](docs/observabilidade.md) | Instrumentação, consultas NRQL dos dashboards e alertas |
| [RFCs](docs/rfc/) | Escolha da nuvem, do banco e da estratégia de autenticação |
| [ADRs](docs/adr/) | Oito decisões arquiteturais permanentes |

Índice completo em [`docs/`](docs/README.md).

---

## Documentação da API

- **Collection completa (OpenAPI, importável no Postman/Insomnia)**: [`docs/openapi.json`](docs/openapi.json) — veja [`docs/openapi.md`](docs/openapi.md) para instruções de importação. Versionada no repositório, não depende da infraestrutura estar no ar.
- **Swagger ao vivo**: https://dzsca8yk0b.execute-api.sa-east-1.amazonaws.com/api/docs — enquanto a infraestrutura estiver provisionada
- **Swagger local**: http://localhost:3000/api/docs (com `npm run start:dev`)
- **Swagger ao vivo**: disponível enquanto a infraestrutura estiver provisionada (veja [`oficina-infra-k8s`](https://github.com/Luizustavo/oficina-infra-k8s)) — pode não responder se a infra tiver sido destruída no momento do acesso

## Vídeo demonstrativo

_[a gravar — deploy da aplicação, execução do CI/CD, consumo das APIs e escalabilidade automática]_

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

Cobertura atual:

| Métrica | Cobertura |
|---|---|
| Statements | ≥ 84% |
| Branches | ≥ 88% |
| Functions | ≥ 85% |
| Lines | ≥ 84% |

---

## Fluxo de uma Ordem de Serviço

```
RECEIVED → IN_DIAGNOSIS → AWAITING_APPROVAL → IN_PROGRESS → COMPLETED → DELIVERED
                                                    ↓
                                                CANCELED (de qualquer estado exceto DELIVERED)
```

A cada transição, o cliente recebe um e-mail automático. A transição `AWAITING_APPROVAL → IN_PROGRESS` (ou `→ CANCELED`, em caso de recusa) também pode ser disparada externamente via `PATCH /service-orders/track/:orderNumber/budget-decision`, sem autenticação — pensado para integração com um sistema de aprovação de orçamento de terceiros.

---

## Análise de Qualidade e Segurança (SonarQube)

O projeto inclui configuração pronta para análise estática com SonarQube Community via Docker.

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

  
