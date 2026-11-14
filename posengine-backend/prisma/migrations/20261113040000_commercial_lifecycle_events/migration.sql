-- CreateEnum
CREATE TYPE "PurchaseLifecycleAction" AS ENUM ('CANCEL');

-- CreateEnum
CREATE TYPE "SaleLifecycleAction" AS ENUM ('CANCEL', 'RESTORE');

-- CreateTable
CREATE TABLE "purchase_lifecycle_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" "PurchaseLifecycleAction" NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_lifecycle_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_lifecycle_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" "SaleLifecycleAction" NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_lifecycle_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "purchase_lifecycle_events_tenantId_purchaseId_createdAt_idx" ON "purchase_lifecycle_events"("tenantId", "purchaseId", "createdAt");

-- CreateIndex
CREATE INDEX "purchase_lifecycle_events_actorId_idx" ON "purchase_lifecycle_events"("actorId");

-- CreateIndex
CREATE INDEX "sale_lifecycle_events_tenantId_saleId_createdAt_idx" ON "sale_lifecycle_events"("tenantId", "saleId", "createdAt");

-- CreateIndex
CREATE INDEX "sale_lifecycle_events_actorId_idx" ON "sale_lifecycle_events"("actorId");

-- AddForeignKey
ALTER TABLE "purchase_lifecycle_events" ADD CONSTRAINT "purchase_lifecycle_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_lifecycle_events" ADD CONSTRAINT "purchase_lifecycle_events_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_lifecycle_events" ADD CONSTRAINT "purchase_lifecycle_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_lifecycle_events" ADD CONSTRAINT "sale_lifecycle_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_lifecycle_events" ADD CONSTRAINT "sale_lifecycle_events_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_lifecycle_events" ADD CONSTRAINT "sale_lifecycle_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
