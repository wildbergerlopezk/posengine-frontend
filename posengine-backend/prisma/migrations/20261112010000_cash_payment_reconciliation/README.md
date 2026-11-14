# Cash payment reconciliation migration

This additive migration adds nullable customer-payment session attribution,
formalizes the existing nullable supplier-payment session reference, and adds
an append-only audit table for manual tender classification. It does not
backfill historical payment methods or session IDs.

Apply the existing `20261111040000_add_supplier_payment_method` migration
before this one. Verify that non-null supplier `cashSessionId` values refer to
existing cash sessions before applying the new foreign key.

`rollback.sql` is a manual rollback aid only before classified payments or
audit records are relied upon. Running it later removes audit evidence and
session attribution; do not use it as a routine deployment rollback.
