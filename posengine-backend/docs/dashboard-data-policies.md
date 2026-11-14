# Dashboard: calendar and currency policies

## Business calendar

The Dashboard uses `BUSINESS_TIME_ZONE`, which defaults to `America/Asuncion`. Set the environment variable to another IANA timezone only when the business location changes; fixed UTC offsets are not used.

The current `Sale.saleDate` and `CustomerPayment.paymentDate` columns are PostgreSQL `timestamp without time zone`. The application writes and reads these values using UTC instants; the Dashboard therefore treats the stored timestamp fields as UTC wall time and converts them to the Paraguay business calendar with PostgreSQL's IANA timezone data. It does not rewrite or reinterpret historical rows.

Daily and monthly boundaries include their start and exclude their end. For the current day and month, the current instant is also an exclusive upper bound, so future-dated rows are omitted.

## Credit sales and collections

`billing.creditBalanceToday` is the current `Sale.remainingBalance` total for completed credit sales dated today. It shows the outstanding balance from today's credit sales after recorded deposits and later payments have been applied. It is not gross credit sales and does not include payments against older sales. `collections.today` counts the separate cash sale totals and valid customer payment records, so the credit sale total is never added to collections.

This policy matches the UTC database configuration and stored timestamps observed in the isolated QA PostgreSQL environment. Since the columns do not preserve an original timezone, older rows written under a different convention cannot be identified or corrected from the stored value alone.

## Currency

Sale totals, customer payments, customer balances, product prices, and cash-session amounts are decimal values without a currency column. Sale creation also has no currency field. The application has one persisted numeric denomination for these records; the Dashboard presents it as Paraguayan guaraníes (`PYG`, `es-PY`) and does not combine records carrying separate currency codes because the current models cannot represent them.

The data contract does not independently prove the denomination of every historical value. The Dashboard follows the product's Paraguay operating convention; historical amounts that were manually entered in another currency cannot be detected without a stored currency attribute. Supporting multiple currencies requires an explicit commercial decision and data model before conversion or aggregation.
