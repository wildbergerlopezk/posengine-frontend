-- Add explicit attribution to customer payments. Existing rows remain NULL and
-- are attributed only after the service proves a unique open-session match.
ALTER TABLE "customer_payments" ADD COLUMN "cashSessionId" TEXT;
CREATE INDEX "customer_payments_cashSessionId_idx" ON "customer_payments"("cashSessionId");
ALTER TABLE "customer_payments"
  ADD CONSTRAINT "customer_payments_cashSessionId_fkey"
  FOREIGN KEY ("cashSessionId") REFERENCES "cash_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Formalize the existing nullable supplier session id without filling history.
CREATE INDEX "purchase_debt_payments_cashSessionId_idx" ON "purchase_debt_payments"("cashSessionId");
ALTER TABLE "purchase_debt_payments"
  ADD CONSTRAINT "purchase_debt_payments_cashSessionId_fkey"
  FOREIGN KEY ("cashSessionId") REFERENCES "cash_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TYPE "CashPaymentClassificationType" AS ENUM ('CUSTOMER', 'SUPPLIER');

CREATE TABLE "cash_payment_classification_audits" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "cashSessionId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "type" "CashPaymentClassificationType" NOT NULL,
  "customerPaymentId" TEXT,
  "supplierPaymentId" TEXT,
  "previousMethod" "PaymentMethod",
  "newMethod" "PaymentMethod" NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cash_payment_classification_audits_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cash_payment_classification_audits_exactly_one_payment_check"
    CHECK (("type" = 'CUSTOMER' AND "customerPaymentId" IS NOT NULL AND "supplierPaymentId" IS NULL)
        OR ("type" = 'SUPPLIER' AND "supplierPaymentId" IS NOT NULL AND "customerPaymentId" IS NULL))
);

CREATE INDEX "cash_payment_classification_audits_tenantId_cashSessionId_createdAt_idx"
  ON "cash_payment_classification_audits"("tenantId", "cashSessionId", "createdAt");
CREATE INDEX "cash_payment_classification_audits_customerPaymentId_idx"
  ON "cash_payment_classification_audits"("customerPaymentId");
CREATE INDEX "cash_payment_classification_audits_supplierPaymentId_idx"
  ON "cash_payment_classification_audits"("supplierPaymentId");

ALTER TABLE "cash_payment_classification_audits"
  ADD CONSTRAINT "cash_payment_classification_audits_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "cash_payment_classification_audits_cashSessionId_fkey"
    FOREIGN KEY ("cashSessionId") REFERENCES "cash_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "cash_payment_classification_audits_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "cash_payment_classification_audits_customerPaymentId_fkey"
    FOREIGN KEY ("customerPaymentId") REFERENCES "customer_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "cash_payment_classification_audits_supplierPaymentId_fkey"
    FOREIGN KEY ("supplierPaymentId") REFERENCES "purchase_debt_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
