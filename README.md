# Oficina Backend — Tech Challenge SOAT Fase 1

Sistema de gerenciamento de ordens de serviço para uma oficina mecânica, desenvolvido com **NestJS**, **Prisma**, **PostgreSQL** e arquitetura **Clean Architecture + DDD**.

---

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Framework | NestJS 11 + TypeScript (strict) |
| ORM | Prisma 7 + `@prisma/adapter-pg` |
| Banco de Dados | PostgreSQL 16 |
| Autenticação | JWT (access token 15 min + refresh token 7 dias) |
| Documentação | Swagger / OpenAPI |
| Testes | Jest (cobertura ≥ 80%) |

---

## Pré-requisitos

- Node.js ≥ 20
- Docker e Docker Compose
- npm

---

## Setup

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

Confirme que o arquivo `.env` existe na raiz do projeto `oficina-backend/`:

```env
DATABASE_URL="postgresql://oficina_user:oficina_pass@localhost:5432/oficina_db"
DATABASE_TEST_URL="postgresql://oficina_user:oficina_pass@localhost:5433/oficina_test_db"
JWT_SECRET="dev-jwt-secret-change-in-production"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_SECRET="dev-refresh-secret-change-in-production"
JWT_REFRESH_EXPIRES_IN="7d"
PORT=3000
NODE_ENV="development"
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

## Documentação da API

Acesse o Swagger em: **http://localhost:3000/api/docs**

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

## Endpoints principais

| Recurso | Método | Rota |
|---|---|---|
| Login | POST | `/api/auth/login` |
| Refresh token | POST | `/api/auth/refresh` |
| Criar usuário | POST | `/api/auth/register` |
| Clientes | GET/POST | `/api/customers` |
| Cliente por ID | GET/PUT/DELETE | `/api/customers/:id` |
| Veículos | GET/POST | `/api/vehicles` |
| Veículos por cliente | GET | `/api/vehicles/customer/:customerId` |
| Serviços | GET/POST | `/api/services` |
| Ativar/desativar serviço | PATCH | `/api/services/:id/toggle` |
| Peças | GET/POST | `/api/parts` |
| Peças em estoque baixo | GET | `/api/parts/low-stock` |
| Adicionar estoque | PATCH | `/api/parts/:id/add-stock` |
| Ordens de serviço | GET/POST | `/api/service-orders` |
| OS por cliente | GET | `/api/service-orders/customer/:customerId` |
| OS por status | GET | `/api/service-orders/status/:status` |
| **Rastrear OS (público)** | **GET** | **`/api/service-orders/track/:orderNumber`** |
| **Tempo médio de execução** | **GET** | **`/api/service-orders/metrics/average-execution-time`** |
| OS por ID | GET | `/api/service-orders/:id` |
| Adicionar serviço à OS | PATCH | `/api/service-orders/:id/services` |
| Adicionar peça à OS | PATCH | `/api/service-orders/:id/parts` |
| Iniciar diagnóstico | PATCH | `/api/service-orders/:id/start-diagnosis` |
| Solicitar aprovação | PATCH | `/api/service-orders/:id/request-approval` |
| Aprovar OS | PATCH | `/api/service-orders/:id/approve` |
| Concluir OS | PATCH | `/api/service-orders/:id/complete` |
| Entregar OS | PATCH | `/api/service-orders/:id/deliver` |
| Cancelar OS | PATCH | `/api/service-orders/:id/cancel` |

> `GET /api/service-orders/track/:orderNumber` é público (sem autenticação) — destinado ao cliente acompanhar o status da OS.

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
| Statements | ≥ 83% |
| Branches | ≥ 84% |
| Functions | ≥ 87% |
| Lines | ≥ 82% |

---

## Fluxo de uma Ordem de Serviço

```
RECEIVED → IN_DIAGNOSIS → AWAITING_APPROVAL → IN_PROGRESS → COMPLETED → DELIVERED
                                                    ↓
                                                CANCELED (de qualquer estado exceto DELIVERED)
```

---

## Arquitetura

```
src/
├── domain/              # Entidades, value objects, interfaces de repositório
│   ├── customer/
│   ├── vehicle/
│   ├── service/
│   ├── part/
│   ├── service-order/
│   ├── user/
│   └── value-objects/
├── application/         # Casos de uso (Use Cases)
│   └── use-cases/
├── infrastructure/      # Implementações concretas (Prisma, JWT, bcrypt)
│   ├── database/
│   └── auth/
└── presentation/        # Controllers, Guards, Decorators, Filters
    ├── controllers/
    ├── guards/
    └── filters/
```



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
