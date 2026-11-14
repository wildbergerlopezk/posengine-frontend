-- CreateEnum
CREATE TYPE "SaleReturnStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SaleReturnItemDisposition" AS ENUM ('RESTOCKABLE', 'DAMAGED');

-- CreateEnum
CREATE TYPE "SaleReturnSettlementStatus" AS ENUM ('PENDING', 'PARTIALLY_SETTLED', 'SETTLED');

-- AlterTable
ALTER TABLE "purchase_return_refund_receipts" ADD COLUMN     "createdByUserId" TEXT;

-- CreateTable
CREATE TABLE "sale_returns" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "status" "SaleReturnStatus" NOT NULL DEFAULT 'PENDING',
    "returnDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "total" DECIMAL(12,2) NOT NULL,
    "debtOffsetAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "sale_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_return_items" (
    "id" TEXT NOT NULL,
    "saleReturnId" TEXT NOT NULL,
    "saleItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "disposition" "SaleReturnItemDisposition" NOT NULL,

    CONSTRAINT "sale_return_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_return_debt_adjustments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "saleReturnId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_return_debt_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_return_settlements" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "saleReturnId" TEXT NOT NULL,
    "status" "SaleReturnSettlementStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(12,2) NOT NULL,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_return_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_return_refund_receipts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "cashSessionId" TEXT,
    "createdByUserId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_return_refund_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sale_returns_tenantId_idx" ON "sale_returns"("tenantId");

-- CreateIndex
CREATE INDEX "sale_returns_saleId_idx" ON "sale_returns"("saleId");

-- CreateIndex
CREATE INDEX "sale_returns_status_idx" ON "sale_returns"("status");

-- CreateIndex
CREATE INDEX "sale_returns_createdByUserId_idx" ON "sale_returns"("createdByUserId");

-- CreateIndex
CREATE INDEX "sale_return_items_saleReturnId_idx" ON "sale_return_items"("saleReturnId");

-- CreateIndex
CREATE INDEX "sale_return_items_saleItemId_idx" ON "sale_return_items"("saleItemId");

-- CreateIndex
CREATE INDEX "sale_return_items_productId_idx" ON "sale_return_items"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "sale_return_debt_adjustments_saleReturnId_key" ON "sale_return_debt_adjustments"("saleReturnId");

-- CreateIndex
CREATE INDEX "sale_return_debt_adjustments_tenantId_idx" ON "sale_return_debt_adjustments"("tenantId");

-- CreateIndex
CREATE INDEX "sale_return_debt_adjustments_saleId_idx" ON "sale_return_debt_adjustments"("saleId");

-- CreateIndex
CREATE INDEX "sale_return_settlements_tenantId_idx" ON "sale_return_settlements"("tenantId");

-- CreateIndex
CREATE INDEX "sale_return_settlements_saleReturnId_idx" ON "sale_return_settlements"("saleReturnId");

-- CreateIndex
CREATE INDEX "sale_return_refund_receipts_tenantId_idx" ON "sale_return_refund_receipts"("tenantId");

-- CreateIndex
CREATE INDEX "sale_return_refund_receipts_settlementId_idx" ON "sale_return_refund_receipts"("settlementId");

-- CreateIndex
CREATE INDEX "sale_return_refund_receipts_cashSessionId_idx" ON "sale_return_refund_receipts"("cashSessionId");

-- CreateIndex
CREATE INDEX "sale_return_refund_receipts_createdByUserId_idx" ON "sale_return_refund_receipts"("createdByUserId");

-- CreateIndex
CREATE INDEX "purchase_return_refund_receipts_createdByUserId_idx" ON "purchase_return_refund_receipts"("createdByUserId");

-- AddForeignKey
ALTER TABLE "purchase_return_refund_receipts" ADD CONSTRAINT "purchase_return_refund_receipts_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_return_items" ADD CONSTRAINT "sale_return_items_saleReturnId_fkey" FOREIGN KEY ("saleReturnId") REFERENCES "sale_returns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_return_items" ADD CONSTRAINT "sale_return_items_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "sale_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_return_items" ADD CONSTRAINT "sale_return_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_return_debt_adjustments" ADD CONSTRAINT "sale_return_debt_adjustments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_return_debt_adjustments" ADD CONSTRAINT "sale_return_debt_adjustments_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_return_debt_adjustments" ADD CONSTRAINT "sale_return_debt_adjustments_saleReturnId_fkey" FOREIGN KEY ("saleReturnId") REFERENCES "sale_returns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_return_settlements" ADD CONSTRAINT "sale_return_settlements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_return_settlements" ADD CONSTRAINT "sale_return_settlements_saleReturnId_fkey" FOREIGN KEY ("saleReturnId") REFERENCES "sale_returns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_return_refund_receipts" ADD CONSTRAINT "sale_return_refund_receipts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_return_refund_receipts" ADD CONSTRAINT "sale_return_refund_receipts_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "sale_return_settlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_return_refund_receipts" ADD CONSTRAINT "sale_return_refund_receipts_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "cash_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_return_refund_receipts" ADD CONSTRAINT "sale_return_refund_receipts_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
