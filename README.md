# Oficina Backend — Tech Challenge SOAT Fase 2

Sistema de gerenciamento de ordens de serviço para uma oficina mecânica, desenvolvido com **NestJS**, **Prisma**, **PostgreSQL** e arquitetura **Clean Architecture + DDD**.

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

k3s (Kubernetes leve, mas 100% real) roda numa única EC2 em vez de usar EKS gerenciado — o control plane do EKS cobra taxa fixa por hora sem free tier, enquanto a EC2 e o RDS escolhidos são elegíveis ao free tier de conta nova. Isso mantém o custo em ~US$0,04–0,07/hora em vez de ~US$0,37/hora. Detalhes e justificativa completa em [`infra/README.md`](infra/README.md).

### Fluxo de deploy

```
1. terraform apply     → provisiona VPC, EC2 (k3s), RDS, ECR, alerta de orçamento
2. docker build/push   → imagem da API publicada no ECR
3. kubectl apply        → namespace, ConfigMap e Secret (uma vez, manual)
4. Job de migração      → prisma migrate deploy contra o RDS
5. Deployment/Service/HPA → aplicação no ar, escalando de 2 a 6 réplicas
```

Os passos 2–5 são automatizados pelo pipeline de CI/CD (`.github/workflows/cd-production.yml`) a cada push em `main`.

### Diagrama visual

📐 **[Diagrama de instalação completo](https://claude.ai/code/artifact/e646173e-e40c-4913-a41a-048c2f865e57)** — topologia da rede, lista de componentes e fluxo de deploy.

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

Scripts completos em [`/infra`](infra), com instruções detalhadas, tabela de recursos e estimativa de custo em [`infra/README.md`](infra/README.md).

```bash
cd infra
terraform init
terraform plan
terraform apply
```

**Importante:** a infraestrutura é destruída (`terraform destroy`) ao final de cada sessão de trabalho para controlar custo — veja o checklist em `infra/README.md`.

## CI/CD

`.github/workflows/ci.yml` builda, testa (unitário/integração/e2e) e valida a imagem Docker em todo push/PR. `.github/workflows/cd-production.yml` faz o deploy de verdade em push para `main` (ou manualmente via **Actions → Deploy to Production → Run workflow**): publica a imagem no ECR, roda a migração e atualiza Deployment/Service/HPA no cluster — descobrindo o nó k3s dinamicamente por tag, sem depender de IP fixo ou de state local do Terraform.

---

## Documentação da API

- **Collection completa (OpenAPI, importável no Postman/Insomnia)**: [`docs/openapi.json`](docs/openapi.json) — veja [`docs/openapi.md`](docs/openapi.md) para instruções de importação. Versionada no repositório, não depende da infraestrutura estar no ar.
- **Swagger local**: http://localhost:3000/api/docs
- **Swagger ao vivo**: disponível enquanto a infraestrutura estiver provisionada (veja `infra/README.md`) — pode não responder se a infra tiver sido destruída no momento do acesso

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

 
