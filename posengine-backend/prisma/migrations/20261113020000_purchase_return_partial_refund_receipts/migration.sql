ALTER TYPE "PurchaseReturnSettlementStatus" ADD VALUE 'PARTIALLY_SETTLED';

CREATE TABLE "purchase_return_refund_receipts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "cashSessionId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "purchase_return_refund_receipts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "purchase_return_refund_receipts_tenantId_idx" ON "purchase_return_refund_receipts"("tenantId");
CREATE INDEX "purchase_return_refund_receipts_settlementId_idx" ON "purchase_return_refund_receipts"("settlementId");
CREATE INDEX "purchase_return_refund_receipts_cashSessionId_idx" ON "purchase_return_refund_receipts"("cashSessionId");

ALTER TABLE "purchase_return_refund_receipts" ADD CONSTRAINT "purchase_return_refund_receipts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_return_refund_receipts" ADD CONSTRAINT "purchase_return_refund_receipts_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "purchase_return_settlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_return_refund_receipts" ADD CONSTRAINT "purchase_return_refund_receipts_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "cash_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
