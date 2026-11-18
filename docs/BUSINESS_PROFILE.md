# Business profile and initial configuration

## Single source of truth

The profile is stored once, as `business_profile` in `catalog_store_settings` (existing schema, no new table). Fiscal data is `fiscal_settings`; the weekly schedule, closures and pickup settings are `pickup_policy`. Everything below reads from those, not from code:

| Surface | Reads |
| --- | --- |
| Footer "Nous trouver / Find us", "Come see us" section on the homepage | profile, `pickup_policy.hours` |
| Structured data (schema.org `FoodEstablishment` JSON-LD on the homepage) | profile, weekly hours. **Published only after the owner confirms the profile** (checkbox in the admin). No email or social links are ever emitted. |
| Checkout pickup instructions, order tracking page | profile |
| Receipts and order emails | snapshot of profile and fiscal settings stored on the order |

Edit all of it in `/{lang}/admin/business` (display name, address, postal code, phone, verification notes, fiscal settings) and `/{lang}/admin/hours` (weekly hours, exceptional closures and special hours, slot length, lead time, capacity, cutoff, advance window). Postal codes are validated and normalised (`H8S 2C5`), phone numbers validated, all server-side, ADMIN only, audited.

## Initial values (one-time initialisation)

`npm run business:init` (`scripts/init-business.mjs`, data in `db/seeds/business-initial.json`) writes the owner-supplied profile once. It uses `INSERT … ON CONFLICT DO NOTHING`, so repeated runs never overwrite anything edited in the admin, writes an audit row only when it inserts, and never touches prices, fiscal settings, the pickup switch, lead time or capacity. `--print-sql` prints the statements; the application never reads the seed file.

| Field | Value | Status |
| --- | --- | --- |
| Display name | Salut Bon Bon Thé (Google Maps name: Bon Bon Thé) | owner-supplied |
| Address | 1175 Rue Notre Dame, Lachine (Québec) H8S 2C5, Canada | owner-supplied, unverified |
| Phone | +1 514-637-6666 | owner-supplied, **not found in any public source** |
| Google Place ID | ChIJNRlHTYMXyUwRdKR_YXvuGHA | stored only; directions links use the address |
| Time zone | America/Toronto | existing |
| Email, social links | none | not invented |

### Verification result (2026-11-18)

The two cited pages (restaurantji.com and notredamelachine.ca) could not be fetched from the build environment because those hosts do not resolve there. A web search found one third-party page listing the shop at 1175 Rue Notre-Dame in Lachine (consistent with the address) with **Monday to Thursday 11:00–20:00**, which **differs from the supplied 10:30–20:00**, and no phone number for this shop (a number found belonged to a different business at 1173). The profile is therefore stored with status `unverified`, which the admin shows and which keeps structured data off.

### Opening hours were not written

The supplied hours (Monday to Saturday 10:30–20:00, Sunday closed) are kept in the seed file but **deliberately not applied**, because verification failed and one source disagrees on the opening time. Until applied, the footer says the hours will be published by the team and no pickup slot exists. Apply them either by running `MIGRATION_DATABASE_URL=… npm run business:init -- --with-hours` (only creates the schedule if none exists; lead time and capacity stay unset) or by entering them in `/admin/hours`. Then tick the confirmation box on the profile once the details are checked against Google Maps.

## Checkout readiness

Pickup checkout opens only when **all** of these hold, and the admin lists exactly which are missing (`BlockerList`): the pickup switch is on, a weekly schedule exists, lead time and capacity are set (no default is invented), a fiscal status is chosen, the profile exists and at least one product has an approved price.
