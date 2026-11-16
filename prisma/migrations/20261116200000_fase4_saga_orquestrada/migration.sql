-- Fase 4 (ADR-011, PLANO-FASE-4 etapa 7.1): estado e histórico da saga
-- orquestrada da OS. Uma saga por tentativa: orderId não é único.

-- CreateEnum
CREATE TYPE "SagaStatus" AS ENUM ('RUNNING', 'COMPLETED', 'COMPENSATING', 'COMPENSATED', 'FAILED');

-- CreateEnum
CREATE TYPE "SagaStep" AS ENUM ('BUDGET_CREATION', 'AWAITING_APPROVAL', 'AWAITING_PAYMENT', 'EXECUTION_QUEUED', 'EXECUTING', 'CANCELING_BUDGET', 'CANCELING_EXECUTION', 'REFUNDING', 'FINISHED');

-- CreateTable
CREATE TABLE "saga_instances" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "step" "SagaStep" NOT NULL,
    "status" "SagaStatus" NOT NULL,
    "deadlineAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saga_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saga_step_logs" (
    "id" TEXT NOT NULL,
    "sagaId" TEXT NOT NULL,
    "step" "SagaStep" NOT NULL,
    "eventType" TEXT NOT NULL,
    "messageId" TEXT,
    "outcome" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saga_step_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saga_instances_orderId_createdAt_idx" ON "saga_instances"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "saga_instances_status_deadlineAt_idx" ON "saga_instances"("status", "deadlineAt");

-- CreateIndex
CREATE INDEX "saga_step_logs_sagaId_createdAt_idx" ON "saga_step_logs"("sagaId", "createdAt");

-- AddForeignKey
ALTER TABLE "saga_instances" ADD CONSTRAINT "saga_instances_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "service_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saga_step_logs" ADD CONSTRAINT "saga_step_logs_sagaId_fkey" FOREIGN KEY ("sagaId") REFERENCES "saga_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

