-- Substitui os campos Json `services` e `parts` de `service_orders` por
-- tabelas de junção com chave estrangeira, e cria os índices que faltavam.
--
-- A migração preserva os dados existentes: as linhas novas são extraídas dos
-- próprios arrays Json antes de as colunas serem removidas.

-- 1. Tabelas de junção -------------------------------------------------------

CREATE TABLE "service_order_services" (
    "id" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "notes" TEXT,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_order_services_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "service_order_parts" (
    "id" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "partName" TEXT NOT NULL,
    "partCode" TEXT NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_order_parts_pkey" PRIMARY KEY ("id")
);

-- 2. Migração dos dados que já existem --------------------------------------
-- `WITH ORDINALITY` devolve o índice de cada elemento dentro do array, que
-- vira a coluna `position` e preserva a ordem original dos itens.

INSERT INTO "service_order_services"
    ("id", "serviceOrderId", "serviceId", "serviceName", "price", "quantity", "notes", "position")
SELECT
    gen_random_uuid()::text,
    so."id",
    item->>'serviceId',
    item->>'serviceName',
    (item->>'price')::DECIMAL(10,2),
    (item->>'quantity')::INTEGER,
    item->>'notes',
    (ord - 1)::INTEGER
FROM "service_orders" so
CROSS JOIN LATERAL jsonb_array_elements(so."services"::jsonb) WITH ORDINALITY AS t(item, ord)
-- Ordens sem serviço nenhum têm array vazio; o LATERAL já não produz linha.
WHERE jsonb_typeof(so."services"::jsonb) = 'array';

INSERT INTO "service_order_parts"
    ("id", "serviceOrderId", "partId", "partName", "partCode", "unitPrice", "quantity", "position")
SELECT
    gen_random_uuid()::text,
    so."id",
    item->>'partId',
    item->>'partName',
    item->>'partCode',
    (item->>'unitPrice')::DECIMAL(10,2),
    (item->>'quantity')::INTEGER,
    (ord - 1)::INTEGER
FROM "service_orders" so
CROSS JOIN LATERAL jsonb_array_elements(so."parts"::jsonb) WITH ORDINALITY AS t(item, ord)
WHERE jsonb_typeof(so."parts"::jsonb) = 'array';

-- `totalPrice` não é migrado de propósito: era o produto de unitPrice por
-- quantity, ambos preservados acima. É recalculado na leitura.

-- 3. Remoção das colunas Json -----------------------------------------------

ALTER TABLE "service_orders" DROP COLUMN "services";
ALTER TABLE "service_orders" DROP COLUMN "parts";

-- 4. Índices e restrições ----------------------------------------------------

CREATE UNIQUE INDEX "service_order_services_serviceOrderId_position_key"
    ON "service_order_services"("serviceOrderId", "position");
CREATE INDEX "service_order_services_serviceOrderId_idx"
    ON "service_order_services"("serviceOrderId");
CREATE INDEX "service_order_services_serviceId_idx"
    ON "service_order_services"("serviceId");

CREATE UNIQUE INDEX "service_order_parts_serviceOrderId_position_key"
    ON "service_order_parts"("serviceOrderId", "position");
CREATE INDEX "service_order_parts_serviceOrderId_idx"
    ON "service_order_parts"("serviceOrderId");
CREATE INDEX "service_order_parts_partId_idx"
    ON "service_order_parts"("partId");

-- O Postgres não cria índice em coluna de chave estrangeira automaticamente.
CREATE INDEX "service_orders_customerId_idx" ON "service_orders"("customerId");
CREATE INDEX "service_orders_vehicleId_idx"  ON "service_orders"("vehicleId");
CREATE INDEX "service_orders_status_createdAt_idx" ON "service_orders"("status", "createdAt");
CREATE INDEX "service_orders_createdAt_idx"  ON "service_orders"("createdAt");
CREATE INDEX "vehicles_customerId_idx"       ON "vehicles"("customerId");
CREATE INDEX "refresh_tokens_userId_idx"     ON "refresh_tokens"("userId");
CREATE INDEX "refresh_tokens_expiresAt_idx"  ON "refresh_tokens"("expiresAt");

-- 5. Chaves estrangeiras ------------------------------------------------------
-- ON DELETE CASCADE nas ordens: apagar uma ordem leva os itens junto.
-- RESTRICT no catálogo: impede apagar um serviço ou peça que alguma ordem
-- histórica referencia — que é justamente a integridade que o Json não dava.

ALTER TABLE "service_order_services"
    ADD CONSTRAINT "service_order_services_serviceOrderId_fkey"
    FOREIGN KEY ("serviceOrderId") REFERENCES "service_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "service_order_services"
    ADD CONSTRAINT "service_order_services_serviceId_fkey"
    FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "service_order_parts"
    ADD CONSTRAINT "service_order_parts_serviceOrderId_fkey"
    FOREIGN KEY ("serviceOrderId") REFERENCES "service_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "service_order_parts"
    ADD CONSTRAINT "service_order_parts_partId_fkey"
    FOREIGN KEY ("partId") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
