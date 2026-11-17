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
npm run test:int                                # Integration tests (test/**/*.integration-spec.ts) — need a live Postgres

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

**ServiceOrder items are junction tables, not JSON:** `ServiceOrder.services` and `ServiceOrder.parts` are Prisma relations to `ServiceOrderService[]` / `ServiceOrderPart[]`, not `Json` columns. The domain entity still works with in-memory `ServiceItem[]` / `PartItem[]` arrays and is unaware of this — only `PrismaServiceOrderMapper` and `ServiceOrderRepository` know. Every read must `include` both relations ordered by `position` (the repository's `WITH_ITEMS` constant); `update()` replaces children wholesale with `deleteMany: {}` + `create`, which Prisma runs in one transaction. In `toPrismaServices`/`toPrismaParts`, pass the relation via `service: { connect: { id } }` and **never** the scalar `serviceId` alongside it — Prisma rejects both together. `PartItem.totalPrice` is derived on read (`unitPrice * quantity`), not a column. Name and price columns on the junction tables are deliberate snapshots of the catalogue at the time the item was added, so repricing a service never changes an already-approved order. See `docs/modelagem-de-dados.md`.

**Observability:** OpenTelemetry starts in `infrastructure/observability/tracing.ts`, called at the very top of `main.ts` **before any other import** — the auto-instrumentations patch `http`, `express`, `pg` and `nestjs`, so an import above that line silently disables telemetry. Logging is Pino via `nestjs-pino` (`logging.config.ts`); use cases keep injecting `Logger` from `@nestjs/common` and `app.useLogger()` redirects it, so the convention above is unchanged. Business metrics live in `service-order.metrics.ts` and `integration.metrics.ts`. Config is read only in `otelConfig()` (`infrastructure/config/otel.config.ts`). See `docs/observabilidade.md`.

**Exception → HTTP mapping:** `HttpExceptionFilter` in `infrastructure/presentation/filters/` maps domain exception subclasses to HTTP status codes (e.g. `NotFoundException` → 404, `ConflictException` → 409, `InvalidStatusTransitionException` → 422). Add new domain exception types there when introducing new exception subclasses. Application-layer code must always throw exceptions from `@shared/exceptions/domain.exceptions`, never NestJS's built-in `@nestjs/common` exceptions (`ConflictException`, `NotFoundException`, etc. from `@nestjs/common` bypass the domain→HTTP mapping and break consistency) — the only sanctioned exception is `UnauthorizedException` in the auth use cases, which maps 1:1 to an HTTP concern.

**Authentication:** JWT access token (15 min) + refresh token (7 days). `JwtAuthGuard` is applied globally; use `@Public()` decorator to opt out on specific routes. `@Roles()` + `RolesGuard` for role-based authorization (`ADMIN`, `MECHANIC`, `ATTENDANT`). JWT secrets/expirations are read in exactly one place, `jwtConfig()` in `infrastructure/config/jwt.config.ts` — call `jwtConfig()` wherever a secret or TTL is needed (`AuthModule`'s `JwtModule.register`, `JwtStrategy`, `login.use-case.ts`, `refresh-token.use-case.ts`). Never read `process.env.JWT_*` directly outside that function. `JWT_SECRET` and `JWT_REFRESH_SECRET` go through `requiredInProduction()`: with `NODE_ENV=production` a missing one stops the boot instead of falling back to the dev default.

**Customer scoping:** A JWT can carry `role: 'CUSTOMER'` (issued by the `oficina-lambda-auth` function, not by `POST /api/auth/login`), so `JwtPayload.role` is typed `TokenRole = UserRole | 'CUSTOMER'` (`domain/enums/token-role.enum.ts`), not `UserRole`. `CustomerScopeGuard` is a third global guard registered **after** `RolesGuard` in `app.module.ts`, and it **denies by default**: a `CUSTOMER` token is rejected on every route that is not explicitly marked `@CustomerScope(...)`. Staff tokens short-circuit out of it on the first line and are unaffected. `@CustomerScope()` with no options allows a customer through with no ownership constraint (use only where there is no owner — `/api/auth/me`, the service catalogue); `@CustomerScope({ param: 'customerId' })` requires that route param to equal `token.sub`; `@CustomerScope({ order: 'id' })` loads the ServiceOrder by that param and requires `order.customerId === token.sub`. A missing order and someone else's order must keep returning the identical error, so the endpoint cannot be used to discover which ids exist. When adding a route reachable by customers, annotate it — a new route without the decorator is closed to customers by design, which fails visibly instead of leaking silently. The guard needs `IServiceOrderRepository`, which is why `ServiceOrdersModule` exports it. See `docs/rfc/rfc-003-estrategia-de-autenticacao.md`.

**ServiceOrder state machine:** Status transitions are enforced by `ServiceOrderStatusVO` in `domain/validators/value-objects/`. Transition table is defined there — update it when adding new statuses, and add every new status to either `SERVICE_ORDER_LIST_STATUS_PRIORITY` or `SERVICE_ORDER_LIST_EXCLUDED_STATUSES`, otherwise orders in it silently disappear from the unfiltered listing. Phase 4 flow (ADR-011): `RECEIVED → IN_DIAGNOSIS → AWAITING_APPROVAL → AWAITING_PAYMENT → PAID → IN_PROGRESS → COMPLETED → DELIVERED`, plus `AWAITING_APPROVAL → IN_DIAGNOSIS` as saga compensation; the entity methods are `approveBudget()`, `confirmPayment()`, `startExecution()` and `revertToDiagnosis()`. `CANCELED` is reachable from any state before `COMPLETED`. There is no direct `AWAITING_APPROVAL → IN_PROGRESS` any more: from `AWAITING_APPROVAL` on, the order is moved by the saga (see **Saga** below), not by staff routes.

**Email notifications on status change:** Every staff-driven ServiceOrder status-transition use case (`start-diagnosis`, `request-approval`, `deliver-order`, `cancel-order`) injects `IEmailNotificationService` (abstract class port in `domain/services/email-notification.service.interface.ts`) and `ServiceOrderMetrics` (`infrastructure/observability/`) in addition to `IServiceOrderRepository` and `Logger`. `ServiceOrderMetrics` comes immediately before `Logger` in the constructor, and `recordTransition({ fromStatus, toStatus, since })` is called right after the repository persists the change — read `order.status` and `order.updatedAt` into locals *before* the entity is mutated, since the transition method overwrites them. Saga-driven transitions (approval, payment, execution, compensations) go through `ProcessSagaEventUseCase`, which records the metric and sends the email the same way but inside `ITransactionManager.afterCommit()`, so a rolled-back event never emails the customer. After persisting the transition, call `emailService.sendServiceOrderStatusUpdate({ to: updated.customerEmail, customerName: updated.customerName, orderNumber, status })`. **Status-transition use cases never inject `ICustomerRepository`**: the customer's name and email (and the vehicle plate) are snapshotted onto the ServiceOrder (`customerName`, `customerEmail`, `vehiclePlate`) by `create-service-order`, the only service-order use case that reads the customer and vehicle repositories. This is the same "snapshot at the time" idea as the item junction tables (ADR-008), and it is what lets the OS Service talk to the other microservices without querying customer tables: editing a customer later does not change where notifications for an already-open order go. The concrete implementation is `ResendEmailNotificationService` (`infrastructure/notification/`), which uses the [Resend](https://resend.com) API and swallows send failures internally (logs a warning) so a notification outage never fails the status transition. `emailConfig()` in `infrastructure/config/email.config.ts` is the single place reading `RESEND_API_KEY`/`EMAIL_FROM`/`EMAIL_ENABLED`; sending is auto-disabled when `NODE_ENV=test` unless `EMAIL_ENABLED` overrides it.

**Messaging (Phase 4, ADR-010):** Services talk to each other only through RabbitMQ, following `docs/arquitetura/contratos-de-mensagens.md` (the contract is the source of truth for envelope, routing keys, topology and retry). Pure rules live in `domain/messaging/` (`SagaEnvelope`, `buildSagaCommand`, `parseSagaEnvelope`, `decideOnFailure`); the RabbitMQ side lives in `infrastructure/messaging/` and is wired by the global `MessagingModule`. Config is read only in `rabbitmqConfig()` (`infrastructure/config/rabbitmq.config.ts`); **without `RABBITMQ_URL` messaging is disabled** (the app boots, nothing connects, outbox rows just wait), which is how unit/E2E tests and broker-less local dev run.
- **Never publish from a use case.** Pass the `OutgoingMessage`s to `IServiceOrderRepository.update(order, messages)`: the order and the `outbox_messages` rows are written in one transaction, and `OutboxRelayService` publishes them every second (`FOR UPDATE SKIP LOCKED`, stops at the first failure to keep order, marks `publishedAt`). `IMessagePublisher` is used only by the relay.
- **Transactions:** `PrismaService.runInTransaction(fn)` opens an interactive transaction and stores it in an `AsyncLocalStorage`; every `PrismaService` model getter returns the active transaction client, so **all repositories join the surrounding transaction automatically** and nested calls reuse it. Don't call `$transaction` directly in repositories; use `runInTransaction`.
- **Publishing is `mandatory` with publisher confirms** (`RabbitMqMessagePublisher`): an unroutable message (target queue not declared yet) becomes `UnroutableMessageError` and stays pending in the outbox instead of being silently dropped.
- **Consuming** (`SagaEventsConsumer`, queue `os.saga-events`): handlers implement `SagaMessageHandler` and register in `SagaMessageHandlerRegistry` by `type` + supported `versions`. The consumer inserts the `messageId` into `processed_messages` and runs the handler in the same transaction: a redelivery is acked with no effect. Handler throws → retry queue (5 s, 30 s, 2 min, header `x-retry-count`) then DLQ; throw `InvalidMessageException` for a message that can never succeed → straight to the DLQ. Unknown `type`/`version` or malformed JSON → DLQ.
- **Tracing across RabbitMQ:** `@opentelemetry/instrumentation-amqplib` is **disabled** in `tracing.ts` because it parents the publish span on the active context and overwrites the `traceparent` stored in the outbox (the relay publishes outside the original request, so every hop started a new trace). `infrastructure/messaging/message-tracing.ts` creates the spans instead: `tracedPublish` (PRODUCER, child of the outbox row's `traceparent`) in the publisher and `tracedConsume` (CONSUMER, child of the message header) around `handle()` in the consumer, so DB spans and the next outbox rows join the same trace. Relay rounds and the `SagaDeadlineScheduler` sweep run under `suppressTracing` so polling does not create empty traces. `withMessageLogContext` (`infrastructure/observability/message-log-context.ts`) adds `sagaId`, `orderId`, `messageType` and `messageId` to every log line written while a message is processed (Pino `mixin`).
- Topology (`infrastructure/messaging/topology.ts`) is declared on every (re)connect; its arguments must stay identical across the three services or the channel fails with `PRECONDITION_FAILED`.

**Saga metrics:** `SagaMetrics` (`infrastructure/observability/saga.metrics.ts`) counts `saga.started` (in `request-approval`), `saga.compensations{trigger}` (the event type that moved a `RUNNING` saga into compensation), `saga.finished{status}` and the `saga.duration` histogram. The executor calls `recordTransition` with the saga status before and after each applied event, inside `afterCommit`, so a rolled-back event is never counted. Attributes are low-cardinality only: never a saga or order id.

**Saga (Phase 4, ADR-011):** The OS Service orchestrates the order across Billing and Execution. Three pieces:
- **Pure orchestrator** `application/saga/service-order-saga.ts`: `decideSagaTransition(state, eventType, detail)` returns `apply` (next `step`/`status`, `deadline` change, `orderAction`, `stock: reserve|release`, command intents), `ignore` (stale or finished saga) or `retry-later` (event ahead of the current step). No Nest/Prisma/RabbitMQ: change the flow here and cover it in `service-order-saga.spec.ts`. Command payloads are built in `saga-commands.ts` exactly as in the contract (money as 2-decimal strings).
- **Executor** `application/use-cases/saga/process-saga-event.use-case.ts`: one transaction per event (`ITransactionManager.run`): loads the current saga, decides, reserves/releases stock (a failed reservation turns into the internal `saga.parts.unavailable` event → cancel the budget), mutates the order, writes the commands to the outbox through `IServiceOrderRepository.update(order, messages)`, moves the saga, appends a `SagaStepLog`, and schedules email/metrics with `afterCommit`. Throws `InvalidMessageException` (→ DLQ) for an order with no saga and `SagaEventOutOfOrderException` (→ retry) for `retry-later`.
- **Entry points:** `request-approval` starts the saga (order → `AWAITING_APPROVAL`, `SagaInstanceEntity.start`, `billing.budget.create` in the outbox, same transaction); `SagaEventHandlers` (`infrastructure/messaging/`) registers every broker event of `BROKER_SAGA_EVENTS` and calls the executor; `cancel-order` with a `RUNNING` saga sends the internal `saga.manual-cancel` event so the saga compensates.
- **One saga per attempt:** `saga_instances.orderId` is not unique; the current saga is the most recent (`ISagaRepository.findCurrentByOrderId`). Events carrying an older `sagaId` are ignored as stale.
- **Stock is reserved at budget approval, not when a part is added**: `add-part-to-order` only checks availability; releasing stock is a saga compensation.
- **Concurrency:** the executor reads the saga with `ISagaRepository.lockCurrentByOrderId` (`SELECT ... FOR UPDATE`), so two events for the same saga (different replicas, or an event racing a timeout) are applied one after the other and the second one sees the new state. Never read the saga without the lock inside the executor; `test/integration/saga.integration-spec.ts` ("trava da saga") fails without it.
- **Timeouts:** `sagaConfig()` (`SAGA_APPROVAL_TIMEOUT_SECONDS`, `SAGA_PAYMENT_TIMEOUT_SECONDS`, via the `SagaSettings` token) sets `deadlineAt` when entering approval/payment. `SagaDeadlineScheduler` (`infrastructure/saga/`, every `SAGA_SWEEP_INTERVAL_SECONDS`, 0 disables) runs `ExpireSagaDeadlinesUseCase`, which sends the internal `saga.approval.timeout` / `saga.payment.timeout` event of the current step through the executor.
- **Query:** `GET /api/service-orders/:id/saga` (`GetServiceOrderSagaUseCase`, `@CustomerScope({ order: 'id' })`) returns the current saga and its `SagaStepLog` history.

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
# Optional locally: without it messaging is disabled
RABBITMQ_URL=amqp://user:pass@localhost:5672/oficina
```

### Test Coverage

Jest is configured to collect coverage only from `domain/**` and `application/**`, excluding `*.module.ts`, `*.interface.ts`, and `*.repository.interface.ts`. The 80% threshold applies to branches, functions, lines, and statements across those layers.
