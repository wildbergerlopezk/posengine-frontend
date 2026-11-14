-- Only use before reconciliation/audit rows are relied upon. Rolling back
-- after classification discards the audit trail and explicit associations.
DROP TABLE "cash_payment_classification_audits";
DROP TYPE "CashPaymentClassificationType";
ALTER TABLE "purchase_debt_payments" DROP CONSTRAINT "purchase_debt_payments_cashSessionId_fkey";
DROP INDEX "purchase_debt_payments_cashSessionId_idx";
ALTER TABLE "customer_payments" DROP CONSTRAINT "customer_payments_cashSessionId_fkey";
DROP INDEX "customer_payments_cashSessionId_idx";
ALTER TABLE "customer_payments" DROP COLUMN "cashSessionId";
