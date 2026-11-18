# Sales tax (GST/QST) and Québec restaurant billing

## What the code does

- **One source of truth:** fiscal settings are stored as `fiscal_settings` in `catalog_store_settings` and edited in `/{lang}/admin/business`. The pickup policy no longer carries tax rates (`taxRates` is ignored if an old document has it).
- **Status gate** (`src/business-core.ts`): `unconfigured` (default, checkout closed), `registered` (GST and QST are collected) or `not_registered` (no tax is collected). `registered` cannot be saved without a legal name, a GST number (`123456789 RT 0001`) and a QST number (`1234567890 TQ 0001`). Unknown numbers stay blank; nothing is invented and no tax is collected without registration.
- **Calculation:** GST 5 % (`5000`) and QST 9.975 % (`9975`), in thousandths of one percent, each applied to the **pre-tax subtotal** (QST is not charged on GST) and each rounded to the cent. Rates are editable but default to these values. Tests: `tests/business.test.ts`, `tests/tax.test.ts`.
- **Every order stores** `tax_cents`, `tax_breakdown` (GST and QST amounts separately) and `business_snapshot` (trade name, legal name, address, phone, tax status and registration numbers at the time of the order) (migration 008). Later edits never rewrite a past receipt.
- **Receipt:** `/{lang}/track/<private token>/receipt` shows the establishment, bill number (the order number), date, itemised lines, pre-tax subtotal, GST and QST with their registration numbers, total and payment status. Order emails carry the same breakdown and registration details. Stripe's own receipt is not relied on for this.

## What Revenu Québec says (and how it was checked)

The two Revenu Québec pages named in the brief could not be fetched from the build environment (the host does not resolve), so the points below come from search summaries of the Revenu Québec pages on restaurants and hotels, mandatory billing in the restaurant sector, preparing invoices and heated foods and beverages. **They were not read in full on the official pages. Confirm each point with Revenu Québec or an accountant before relying on it.**

- Food and beverages prepared or sold for immediate consumption in commercial food-service establishments are taxable with GST and QST; drinks such as tea, milk and juice served on the premises are listed as taxable. Freely given tips are not taxed; tips added automatically to the bill are.
- Restaurant operators in Québec generally must register for GST and QST. This **contradicts the earlier assumption in this repository** that a business under the CAD 30,000 small-supplier threshold may stay unregistered; whether that exception applies here must be confirmed.
- **Mandatory billing in the restaurant sector:** operators must give customers bills. QST registrants must produce them with a **certified sales recording system (SRS)**; non-registrants must still issue bills and keep copies.
- A taxable restaurant bill must show: trade name, establishment address, bill date, a unique bill number, itemised descriptions and prices, the pre-tax subtotal, the GST and QST registration numbers, the GST and QST amounts and the total. Bills of CAD 500 or more also need the customer's name and payment terms.
- Records are kept six years. Penalties for non-compliance are reported as CAD 2,000 to 100,000.

## What this application does and does not cover

Covered: registration status gate, legal name and registration numbers, separate GST and QST amounts, unique bill number, establishment details, itemised receipt, snapshot per order, six-year retention (the runtime database role cannot delete orders).

**Not covered and not claimed:** a certified sales recording system (SRS) or any integration with one; the customer-name and payment-terms fields for bills of CAD 500 or more; treatment of tips or service charges; any legal conclusion on whether this business is a "restaurant establishment" for mandatory billing. The site receipt carries the required data but **does not replace the SRS obligation**. Whether online pickup orders must also be recorded in an SRS is a question for Revenu Québec or the accountant.

## Still needed from the business

Legal name, GST and QST numbers (or confirmation that the business is not registered), and the accountant's answer on SRS and invoicing. Until the status is chosen in the admin, checkout stays closed.
