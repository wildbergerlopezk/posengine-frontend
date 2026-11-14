CREATE TYPE "PurchaseReturnSettlementType" AS ENUM ('REFUND', 'SUPPLIER_CREDIT');
CREATE TYPE "PurchaseReturnSettlementStatus" AS ENUM ('PENDING', 'SETTLED', 'PARTIALLY_APPLIED', 'APPLIED');

CREATE TABLE "purchase_debt_adjustments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "purchaseDebtId" TEXT NOT NULL,
    "installmentId" TEXT,
    "purchaseReturnId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "purchase_debt_adjustments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchase_return_settlements" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "purchaseReturnId" TEXT NOT NULL,
    "type" "PurchaseReturnSettlementType" NOT NULL,
    "status" "PurchaseReturnSettlementStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(12,2) NOT NULL,
    "appliedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paymentMethod" "PaymentMethod",
    "cashSessionId" TEXT,
    "settledAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "purchase_return_settlements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchase_return_credit_applications" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "installmentId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "purchase_return_credit_applications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "purchase_debt_adjustments_tenantId_idx" ON "purchase_debt_adjustments"("tenantId");
CREATE INDEX "purchase_debt_adjustments_purchaseDebtId_idx" ON "purchase_debt_adjustments"("purchaseDebtId");
CREATE INDEX "purchase_debt_adjustments_installmentId_idx" ON "purchase_debt_adjustments"("installmentId");
CREATE INDEX "purchase_debt_adjustments_purchaseReturnId_idx" ON "purchase_debt_adjustments"("purchaseReturnId");
CREATE INDEX "purchase_return_settlements_tenantId_idx" ON "purchase_return_settlements"("tenantId");
CREATE INDEX "purchase_return_settlements_purchaseReturnId_idx" ON "purchase_return_settlements"("purchaseReturnId");
CREATE INDEX "purchase_return_settlements_cashSessionId_idx" ON "purchase_return_settlements"("cashSessionId");
CREATE INDEX "purchase_return_credit_applications_tenantId_idx" ON "purchase_return_credit_applications"("tenantId");
CREATE INDEX "purchase_return_credit_applications_settlementId_idx" ON "purchase_return_credit_applications"("settlementId");
CREATE INDEX "purchase_return_credit_applications_purchaseId_idx" ON "purchase_return_credit_applications"("purchaseId");
CREATE INDEX "purchase_return_credit_applications_installmentId_idx" ON "purchase_return_credit_applications"("installmentId");

ALTER TABLE "purchase_debt_adjustments" ADD CONSTRAINT "purchase_debt_adjustments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_debt_adjustments" ADD CONSTRAINT "purchase_debt_adjustments_purchaseDebtId_fkey" FOREIGN KEY ("purchaseDebtId") REFERENCES "purchase_debts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_debt_adjustments" ADD CONSTRAINT "purchase_debt_adjustments_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "purchase_debt_installments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_debt_adjustments" ADD CONSTRAINT "purchase_debt_adjustments_purchaseReturnId_fkey" FOREIGN KEY ("purchaseReturnId") REFERENCES "purchase_returns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_return_settlements" ADD CONSTRAINT "purchase_return_settlements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_return_settlements" ADD CONSTRAINT "purchase_return_settlements_purchaseReturnId_fkey" FOREIGN KEY ("purchaseReturnId") REFERENCES "purchase_returns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_return_settlements" ADD CONSTRAINT "purchase_return_settlements_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "cash_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_return_credit_applications" ADD CONSTRAINT "purchase_return_credit_applications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_return_credit_applications" ADD CONSTRAINT "purchase_return_credit_applications_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "purchase_return_settlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_return_credit_applications" ADD CONSTRAINT "purchase_return_credit_applications_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_return_credit_applications" ADD CONSTRAINT "purchase_return_credit_applications_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "purchase_debt_installments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
