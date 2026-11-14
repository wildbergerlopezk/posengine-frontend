-- PosEngine commercial-history diagnostics.
-- Read-only SELECTs for an explicitly authorized, read-only production copy.
-- Replace the tenant id before running. Do not use the output to create
-- settlements, receipts, credit applications, or repairs automatically.

-- 1) Legacy purchase returns without a settlement record. The amount and
-- returned quantities are evidence of the document only; they do not prove
-- whether the supplier paid cash, transferred funds, or left credit.
WITH item_totals AS (
  SELECT "purchaseReturnId", SUM(total) AS item_total,
         SUM(quantity) AS returned_quantity
  FROM purchase_return_items
  GROUP BY "purchaseReturnId"
), adjustment_totals AS (
  SELECT "purchaseReturnId", SUM(amount) AS debt_adjustment_total
  FROM purchase_debt_adjustments
  GROUP BY "purchaseReturnId"
), settlement_totals AS (
  SELECT "purchaseReturnId", COUNT(*) AS settlement_count,
         SUM(amount) AS settlement_total
  FROM purchase_return_settlements
  GROUP BY "purchaseReturnId"
)
SELECT pr.id AS purchase_return_id,
       pr."returnDate",
       pr.status,
       pr.total AS document_total,
       COALESCE(i.item_total, 0) AS item_total,
       COALESCE(i.returned_quantity, 0) AS returned_quantity,
       COALESCE(a.debt_adjustment_total, 0) AS recorded_debt_adjustment,
       COALESCE(s.settlement_count, 0) AS settlement_count,
       COALESCE(s.settlement_total, 0) AS recorded_settlement_total
FROM purchase_returns pr
LEFT JOIN item_totals i ON i."purchaseReturnId" = pr.id
LEFT JOIN adjustment_totals a ON a."purchaseReturnId" = pr.id
LEFT JOIN settlement_totals s ON s."purchaseReturnId" = pr.id
WHERE pr."tenantId" = 'REPLACE_WITH_TENANT_ID'
  AND pr.status = 'CONFIRMED'
  AND s."purchaseReturnId" IS NULL
ORDER BY pr."returnDate", pr.id;

-- 2) Supplier return settlements whose remaining refund/credit differs from
-- their status or receipt/application ledger. Review manually; never infer a
-- missing receipt from cash-session totals.
WITH receipts AS (
  SELECT "settlementId", SUM(amount) AS received_amount,
         COUNT(*) AS receipt_count
  FROM purchase_return_refund_receipts
  GROUP BY "settlementId"
), applications AS (
  SELECT "settlementId", SUM(amount) AS applied_amount,
         COUNT(*) AS application_count
  FROM purchase_return_credit_applications
  GROUP BY "settlementId"
)
SELECT s.id AS settlement_id,
       s."purchaseReturnId",
       s.type,
       s.status,
       s.amount,
       s."appliedAmount",
       COALESCE(r.received_amount, 0) AS receipt_ledger_amount,
       COALESCE(r.receipt_count, 0) AS receipt_count,
       COALESCE(a.applied_amount, 0) AS application_ledger_amount,
       COALESCE(a.application_count, 0) AS application_count
FROM purchase_return_settlements s
LEFT JOIN receipts r ON r."settlementId" = s.id
LEFT JOIN applications a ON a."settlementId" = s.id
WHERE s."tenantId" = 'REPLACE_WITH_TENANT_ID'
  AND ((s.type = 'REFUND' AND COALESCE(r.received_amount, 0) > s.amount)
    OR (s.type = 'SUPPLIER_CREDIT' AND COALESCE(a.applied_amount, 0) <> s."appliedAmount")
    OR (s.type = 'REFUND' AND s.status = 'SETTLED' AND COALESCE(r.received_amount, 0) <> s.amount)
    OR (s.type = 'SUPPLIER_CREDIT' AND s.status = 'APPLIED' AND s."appliedAmount" <> s.amount))
ORDER BY s."createdAt", s.id;

-- 3) Customer sale returns: compare the retained original sale, debt offset,
-- pending refund, and damaged quantity with their separate ledgers.
WITH damaged AS (
  SELECT "saleReturnId", SUM(quantity) AS damaged_quantity
  FROM sale_return_items
  WHERE disposition = 'DAMAGED'
  GROUP BY "saleReturnId"
), receipts AS (
  SELECT s."saleReturnId", SUM(r.amount) AS refunded_amount,
         COUNT(r.id) AS receipt_count
  FROM sale_return_settlements s
  LEFT JOIN sale_return_refund_receipts r ON r."settlementId" = s.id
  GROUP BY s."saleReturnId"
)
SELECT sr.id AS sale_return_id,
       sr."returnDate",
       sr.status,
       sr.total AS return_total,
       sale.id AS original_sale_id,
       sale."saleDate" AS original_sale_date,
       sale.total AS preserved_original_total,
       sr."debtOffsetAmount",
       COALESCE(d.damaged_quantity, 0) AS damaged_quantity,
       COALESCE(r.refunded_amount, 0) AS refund_receipt_total,
       COALESCE(r.receipt_count, 0) AS refund_receipt_count
FROM sale_returns sr
JOIN sales sale ON sale.id = sr."saleId"
LEFT JOIN damaged d ON d."saleReturnId" = sr.id
LEFT JOIN receipts r ON r."saleReturnId" = sr.id
WHERE sr."tenantId" = 'REPLACE_WITH_TENANT_ID'
ORDER BY sr."returnDate", sr.id;

-- 4) Cash refund receipts tied to closed sessions but dated outside the
-- session interval. This flags attribution anomalies; it does not authorize
-- rewriting a closed snapshot.
SELECT r.id AS receipt_id,
       r."settlementId",
       r.amount,
       r."effectiveAt",
       cs.id AS cash_session_id,
       cs."openedAt",
       cs."closedAt",
       cs."expectedAmount" AS stored_historical_expected_amount
FROM sale_return_refund_receipts r
JOIN cash_sessions cs ON cs.id = r."cashSessionId"
WHERE r."tenantId" = 'REPLACE_WITH_TENANT_ID'
  AND r."paymentMethod" = 'CASH'
  AND cs.status = 'CLOSED'
  AND (r."effectiveAt" < cs."openedAt" OR r."effectiveAt" > cs."closedAt")
UNION ALL
SELECT r.id AS receipt_id,
       r."settlementId",
       r.amount,
       r."effectiveAt",
       cs.id AS cash_session_id,
       cs."openedAt",
       cs."closedAt",
       cs."expectedAmount" AS stored_historical_expected_amount
FROM purchase_return_refund_receipts r
JOIN cash_sessions cs ON cs.id = r."cashSessionId"
WHERE r."tenantId" = 'REPLACE_WITH_TENANT_ID'
  AND r."paymentMethod" = 'CASH'
  AND cs.status = 'CLOSED'
  AND (r."effectiveAt" < cs."openedAt" OR r."effectiveAt" > cs."closedAt")
ORDER BY "effectiveAt", receipt_id;
