-- Fase 4 (ADR-011 e etapa 4.1/4.4.1 do plano):
--   1. Status novos da saga: AWAITING_PAYMENT e PAID.
--   2. Dados do cliente e do veículo gravados na própria OS (customerName,
--      customerEmail, vehiclePlate), como foto do momento da abertura.
--
-- As OS que já existem recebem os valores atuais do cliente e do veículo
-- antes de as colunas virarem obrigatórias; sem isso o NOT NULL falharia.

-- 1. Status novos ------------------------------------------------------------

-- PostgreSQL 12+ aceita ADD VALUE dentro da transação da migração. Os valores
-- novos só não podem ser usados nesta mesma transação, e não são.
ALTER TYPE "ServiceOrderStatus" ADD VALUE 'AWAITING_PAYMENT';
ALTER TYPE "ServiceOrderStatus" ADD VALUE 'PAID';

-- 2. Dados do cliente e do veículo na OS -------------------------------------

ALTER TABLE "service_orders"
    ADD COLUMN "customerName" TEXT,
    ADD COLUMN "customerEmail" TEXT,
    ADD COLUMN "vehiclePlate" TEXT;

UPDATE "service_orders" AS so
SET "customerName" = c."name",
    "customerEmail" = c."email"
FROM "customers" AS c
WHERE c."id" = so."customerId";

UPDATE "service_orders" AS so
SET "vehiclePlate" = v."licensePlate"
FROM "vehicles" AS v
WHERE v."id" = so."vehicleId";

ALTER TABLE "service_orders"
    ALTER COLUMN "customerName" SET NOT NULL,
    ALTER COLUMN "customerEmail" SET NOT NULL,
    ALTER COLUMN "vehiclePlate" SET NOT NULL;
