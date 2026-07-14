# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run start:dev          # Watch mode dev server (port 3000)
npm run build              # Compile TypeScript via NestJS CLI

# Testing
npm test                                        # Unit tests (rootDir: src, matches *.spec.ts)
npm test -- --testPathPattern=customer          # Run tests matching a pattern
npm test -- --coverage                          # Unit tests with coverage (threshold: 80%)
npm run test:e2e                                # E2E tests (test/*.e2e-spec.ts)
npm run test:int                                # Integration tests (test/*.integration-spec.ts)

# Linting
npm run lint                # ESLint with auto-fix

# Database
docker compose up -d                            # Start dev (5432) and test (5433) Postgres containers
npx prisma migrate deploy                       # Apply migrations
npm run prisma:migrate                          # Create and apply new migration (dev)
npm run prisma:seed                             # Seed with initial data
npm run prisma:generate                         # Regenerate Prisma client after schema changes
npm run prisma:studio                           # Open Prisma Studio GUI
```

## Architecture

This is a **NestJS + Clean Architecture + DDD** application for a mechanical workshop management system.

### Layer Boundaries

```
src/
├── domain/              # Pure business logic — no framework dependencies
│   ├── entities/        # Rich entities with private props, static create/reconstitute factories
│   ├── repositories/    # Abstract classes (not interfaces) used as DI tokens
│   ├── services/        # Abstract classes for external-service ports (e.g. IEmailNotificationService)
│   ├── validators/
│   │   └── value-objects/  # CPF, CNPJ, LicensePlate, ServiceOrderStatus VOs
│   └── enums/
├── application/         # Orchestration layer
│   ├── use-cases/       # One class per use case, injected with IRepository abstract classes
│   ├── dtos/            # Request/response DTOs with class-validator decorators
│   └── mappers/         # DTO ↔ Entity conversion (static-only classes)
├── infrastructure/
│   ├── database/prisma/
│   │   ├── repositories/    # Concrete repository implementations
│   │   └── mappers/         # Prisma model ↔ Domain entity conversion
│   ├── presentation/
│   │   ├── controllers/     # NestJS controllers
│   │   ├── modules/         # Feature modules that wire DI
│   │   ├── guards/          # JwtAuthGuard (global), RolesGuard
│   │   ├── decorators/      # @Public(), @Roles(), @CurrentUser()
│   │   └── filters/         # HttpExceptionFilter (global catch-all)
│   ├── notification/        # ResendEmailNotificationService (IEmailNotificationService impl)
│   └── config/              # JwtStrategy, jwt.config, email.config
└── shared/
    └── exceptions/          # Domain exception hierarchy (DomainException subclasses)
```

### Key Patterns

**Repository as abstract class (DI token):** Repository interfaces are defined as `abstract class IXxxRepository` in `domain/repositories/`. This lets NestJS use them directly as injection tokens: `{ provide: ICustomerRepository, useClass: CustomerRepository }`. Never use TypeScript `interface` for repositories.

**Entity factories:** Entities expose `static create(props, id?: string)` (validates + sets timestamps) and `static reconstitute(props, id?: string)` (no validation, used by mappers when rehydrating from DB). Both factories accept an optional `id` as a **separate trailing argument** — never embed `id` inside the props object. Domain validation throws `DomainException` subclasses.

**One use case per file:** Every use case is its own file under `application/use-cases/{module}/`, named `{verb}-{entity}.use-case.ts` (e.g. `create-part.use-case.ts`, `list-vehicles-by-customer.use-case.ts`, `approve-order.use-case.ts`). Never bundle multiple use-case classes in a single file. Each use case is injected with the `IXxxRepository` abstract class(es) it needs and a `Logger` (see Logging below).

**Use case body shape:** `execute()` follows: receive DTO → validate/look up via repository → mutate/create the entity → map entity back to a response DTO → return it. The final step always assigns the mapped result to a `const response: XxxResponseDto = XxxMapper.toResponse(entity);` and returns that variable on the next line — never `return XxxMapper.toResponse(entity);` inline. This applies to single-entity responses; list use cases return the `PaginatedResponseDto`/array produced by `PaginationMapper.toResponse(...)` the same way.

**Mapper pipeline:** Incoming request → DTO (validated by class-validator) → `ApplicationMapper.toEntity()` → Use case → `PrismaMapper.toPrisma()` → Prisma → `PrismaMapper.toEntity()` (via `XxxEntity.reconstitute()`, never `new XxxEntity()`) → `ApplicationMapper.toResponse()` → Response DTO. Application mappers live in `application/mappers/` (one static class per entity: `CustomerMapper`, `PartMapper`, `ServiceMapper`, `VehicleMapper`, `ServiceOrderMapper`, `UserMapper`), Prisma mappers in `infrastructure/database/prisma/mappers/`. Mappers must import response DTOs from `application/dtos/`, never re-export a DTO type through a use-case file.

**Pagination:** List use cases delegate to `PaginationMapper` (`application/mappers/pagination.mapper.ts`) instead of hand-rolling page/limit math. `PaginationMapper.resolveParams({ page, limit })` returns `{ page, limit, skip }` with defaults (`page=1`, `limit=20`) applied; `PaginationMapper.toResponse(data, total, page, limit, entityMapperFn)` builds the full `PaginatedResponseDto`. Never inline `Math.ceil(total / limit)` or the `{ data, total, page, limit, totalPages }` object by hand.

**Logging:** Every use case constructor injects `Logger` from `@nestjs/common` as the last constructor parameter, and every module that provides use cases must list `Logger` in its `providers` array. Inside `execute()`: `this.logger.log(...)` at the start describing the attempted action, `this.logger.warn(...)` immediately before throwing on a business-rule violation or not-found, and a final `this.logger.log(...)` confirming success (with the affected entity's id) right before building the response. See `application/use-cases/auth/create-user.use-case.ts` as the reference implementation.

**Exception → HTTP mapping:** `HttpExceptionFilter` in `infrastructure/presentation/filters/` maps domain exception subclasses to HTTP status codes (e.g. `NotFoundException` → 404, `ConflictException` → 409, `InvalidStatusTransitionException` → 422). Add new domain exception types there when introducing new exception subclasses. Application-layer code must always throw exceptions from `@shared/exceptions/domain.exceptions`, never NestJS's built-in `@nestjs/common` exceptions (`ConflictException`, `NotFoundException`, etc. from `@nestjs/common` bypass the domain→HTTP mapping and break consistency) — the only sanctioned exception is `UnauthorizedException` in the auth use cases, which maps 1:1 to an HTTP concern.

**Authentication:** JWT access token (15 min) + refresh token (7 days). `JwtAuthGuard` is applied globally; use `@Public()` decorator to opt out on specific routes. `@Roles()` + `RolesGuard` for role-based authorization (`ADMIN`, `MECHANIC`, `ATTENDANT`). JWT secrets/expirations are read in exactly one place, `jwtConfig()` in `infrastructure/config/jwt.config.ts` — call `jwtConfig()` wherever a secret or TTL is needed (`AuthModule`'s `JwtModule.register`, `JwtStrategy`, `login.use-case.ts`, `refresh-token.use-case.ts`). Never read `process.env.JWT_*` directly outside that function.

**ServiceOrder state machine:** Status transitions are enforced by `ServiceOrderStatusVO` in `domain/validators/value-objects/`. Transition table is defined there — update it when adding new statuses. Valid flow: `RECEIVED → IN_DIAGNOSIS → AWAITING_APPROVAL → IN_PROGRESS → COMPLETED → DELIVERED`; `CANCELED` is reachable from any state except `DELIVERED`.

**Email notifications on status change:** Every ServiceOrder status-transition use case (`start-diagnosis`, `request-approval`, `approve-order`, `complete-order`, `deliver-order`, `cancel-order`) injects `ICustomerRepository` and `IEmailNotificationService` (abstract class port in `domain/services/email-notification.service.interface.ts`) in addition to `IServiceOrderRepository` and `Logger`. After persisting the transition, look up the customer by `updated.customerId` and, if found, call `emailService.sendServiceOrderStatusUpdate({ to, customerName, orderNumber, status })` — skip silently if the customer isn't found. The concrete implementation is `ResendEmailNotificationService` (`infrastructure/notification/`), which uses the [Resend](https://resend.com) API and swallows send failures internally (logs a warning) so a notification outage never fails the status transition. `emailConfig()` in `infrastructure/config/email.config.ts` is the single place reading `RESEND_API_KEY`/`EMAIL_FROM`/`EMAIL_ENABLED`; sending is auto-disabled when `NODE_ENV=test` unless `EMAIL_ENABLED` overrides it.

### Import Ordering

Within each file, group imports as: (1) plain named imports — `import { A, B } from '...';` — sorted by the length of the `import { ... }` clause **descending** (longest first), ignoring the `from '...'` part entirely; then (2) a blank line, then (3) `import type { ... }`, `import * as x from '...'`, and side-effect imports (`import '...';`), kept in their original relative order. Always use the `@domain/*`, `@application/*`, `@infrastructure/*`, `@shared/*` path aliases (see below) instead of relative imports (`../../../`) — the only relative imports that remain are between files in the same immediate directory. See `application/use-cases/auth/login.use-case.ts` or `main.ts` for reference.

### Path Aliases (tsconfig)

| Alias | Resolves to |
|---|---|
| `@domain/*` | `src/domain/*` |
| `@application/*` | `src/application/*` |
| `@infrastructure/*` | `src/infrastructure/*` |
| `@shared/*` | `src/shared/*` |
| `@generated/*` | `generated/*` (Prisma client) |

Prisma client is generated into `generated/prisma/` (not `node_modules`), configured by `generator client { output = "../generated/prisma" }` in the schema.

### Environment Variables

Required in `.env`:
```
DATABASE_URL=postgresql://oficina_user:oficina_pass@localhost:5432/oficina_db
DATABASE_TEST_URL=postgresql://oficina_user:oficina_pass@localhost:5433/oficina_test_db
JWT_SECRET=...
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=...
JWT_REFRESH_EXPIRES_IN=7d
PORT=3000
NODE_ENV=development
RESEND_API_KEY=...
EMAIL_FROM=onboarding@resend.dev
```

### Test Coverage

Jest is configured to collect coverage only from `domain/**` and `application/**`, excluding `*.module.ts`, `*.interface.ts`, and `*.repository.interface.ts`. The 80% threshold applies to branches, functions, lines, and statements across those layers.
