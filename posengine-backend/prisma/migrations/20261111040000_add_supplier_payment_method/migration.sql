-- Nullable expand-only change. Existing supplier payments remain unclassified.
ALTER TABLE "purchase_debt_payments"
ADD COLUMN "paymentMethod" "PaymentMethod";
