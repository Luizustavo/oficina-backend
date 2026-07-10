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
| Statements | ≥ 82% |
| Branches | ≥ 88% |
| Functions | ≥ 84% |
| Lines | ≥ 81% |

---

## Fluxo de uma Ordem de Serviço

```
RECEIVED → IN_DIAGNOSIS → AWAITING_APPROVAL → IN_PROGRESS → COMPLETED → DELIVERED
                                                    ↓
                                                CANCELED (de qualquer estado exceto DELIVERED)
```

---

## Arquitetura

**Clean Architecture + DDD**, com casos de uso divididos um por arquivo e mapeamento Entity ↔ DTO centralizado em classes estáticas por módulo.

```
src/
├── domain/                        # Regras de negócio puras — sem dependência de framework
│   ├── entities/                   # Customer, Vehicle, Service, Part, ServiceOrder, User
│   ├── repositories/                # Abstract classes usadas como token de DI (IXxxRepository)
│   ├── validators/value-objects/    # CPF, CNPJ, LicensePlate, ServiceOrderStatus
│   └── enums/
├── application/                   # Orquestração
│   ├── use-cases/                  # Um caso de uso por arquivo (create-part, list-vehicles-by-customer, ...)
│   ├── dtos/                       # DTOs de request (class-validator) e response
│   └── mappers/                    # Entity ↔ DTO, um por entidade + PaginationMapper
├── infrastructure/
│   ├── database/prisma/             # Repositórios concretos + mappers Prisma ↔ Entity
│   ├── presentation/                # Controllers, Modules, Guards, Decorators, Filters
│   └── config/                      # JwtStrategy, jwtConfig
└── shared/
    └── exceptions/                 # Hierarquia de DomainException (mapeada para HTTP no filtro global)
```


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
