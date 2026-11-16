-- Fase 4 (ADR-010, etapas 4.6 e 4.7 do plano): Transactional Outbox e
-- registro de mensagens processadas pelo consumidor idempotente.

-- CreateTable
CREATE TABLE "outbox_messages" (
    "id" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "routingKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "traceparent" TEXT,
    "tracestate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "outbox_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_messages" (
    "messageId" TEXT NOT NULL,
    "queue" TEXT NOT NULL,
    "messageType" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_messages_pkey" PRIMARY KEY ("messageId")
);

-- CreateIndex
CREATE INDEX "outbox_messages_publishedAt_createdAt_idx" ON "outbox_messages"("publishedAt", "createdAt");

