-- Manual rollback only before any application has stored a payment method.
-- Dropping this column after CASH/TRANSFER values exist permanently loses them.
ALTER TABLE "purchase_debt_payments"
DROP COLUMN "paymentMethod";
