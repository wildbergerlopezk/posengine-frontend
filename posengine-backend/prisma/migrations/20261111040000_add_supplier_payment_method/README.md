# Supplier payment method

This is an additive nullable column. It deliberately has no default or historical backfill.

`rollback.sql` is a manual down script. Use it only before application code has stored any
new method values. Once CASH or TRANSFER has been recorded, dropping the column would lose
accounting information; roll back application code while retaining the column instead.
