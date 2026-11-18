# Sales tax (GST/QST)

## What the code does

- Rates live in the `pickup_policy` setting (`taxRates`, an array of integers in **thousandths of one percent**). For Québec: GST `5000` and QST `9975`. An empty array means no tax.
- `salesTax(subtotal, rates)` (`src/pickup-policy.ts`) rounds each rate's tax separately to the cent and sums them. Both rates apply to the **pre-tax subtotal**. Québec calculates QST on the price excluding GST, so QST is not compounded on GST.
- Tax is computed on the server from server-priced lines, stored in `orders.tax_cents`, shown to the customer, re-confirmed through `expectedTotal`, included in the Stripe total and in emails. Amounts are integer cents everywhere.
- Tests: `tests/tax.test.ts`, `tests/pickup-policy.test.ts`.

## Not decided by the code. Owner or accountant must confirm before launch

1. Whether the business is registered for GST/QST. A small supplier (under CAD 30,000 in four consecutive quarters) may be unregistered and must not charge tax. Do not enable checkout with rates until the registration numbers exist.
2. Treatment of each product class. Prepared beverages served for immediate consumption are generally taxable in Québec; the code currently applies the same rates to every line. If a product (for example bottled or unprepared goods) is exempt or zero-rated, per-category tax treatment must be added. **No such products exist in the official catalog today, and none were assumed.**
3. Receipts: a registered business must show its GST and QST registration numbers on receipts. They are not configured and no value was invented.
4. Rounding policy if the accountant prefers per-line rounding. The current method rounds per tax, per order.

Sources to check before relying on this: Revenu Québec (QST) and Canada Revenue Agency (GST/HST) guidance on restaurant and beverage sales. This was not re-verified against live agency pages in this environment.
