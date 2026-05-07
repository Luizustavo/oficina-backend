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



## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
