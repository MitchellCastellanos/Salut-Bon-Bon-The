# Isolated, cross-device order and Rewards demonstration

Routes: `/fr/demo-commande` and `/en/demo-order`. Public CTA in the main navigation.

## Architecture and safety

- 62 official products are presented from `catalog/official.json`; two sizes and sample toppings. The server **reprices every line** from `catalog_variants` in the dedicated Neon `order-rewards-demo` branch; client estimates are illustrative.
- `POST /api/demo-orders` creates a **demo-only** record in `demo_orders` on `DEMO_DATABASE_URL`. It never inserts into real `orders`, loyalty accounts, ledgers or payment tables.
- `GET /api/demo-orders?id=...&token=...` retrieves the private order. `PATCH` advances status for the same bearer token. Share the full link to observe/advance from another device; status refreshes every 5 seconds.
- Rewards estimate uses `pointsFor(subtotal, 10)`, based on pre-tax sample spend; 1,000 points are worth $5. **No real points are credited or redeemed.**
- Sample pickup times and GST/QST are for presentation only. No business hours, fiscal registration or prices are approved, and no Stripe/Resend calls are made.
- Orders expire after 7 days; expired rows are purged during new order creation. Limit 20 creations per hour per pseudonymous IP hash. No account login, emails or phone numbers collected.
- The shared token grants both tracking and simulation status updates. It is a **demo capability link**, not real STAFF authentication; share only with participants. Demo API responses are no-store; order tokens are stored as SHA-256 hashes in the database.
- The official logo is at `public/brand/logo.svg`; compare the vector rendering with the owner-provided source. Email raster logo is still pending.

## Neon / Vercel

- Dedicated Neon branch `order-preview-catalog` (`br-little-mouse-bckb16eb`), created from development with 62 catalog products and 124 provisional priced variants. Separate `demo_orders` table with a `client_hash` column and rate index.
- `DEMO_DATABASE_URL` is configured as a sensitive Vercel environment variable for Preview and Production. Never use the live `DATABASE_URL` for the demo endpoint.
- No migrations to the live production branch. The demo table must exist in the dedicated branch; if recreated, use the DDL in this document's companion setup or re-provision explicitly.
- `DEMO_RATE_SALT` optional; set to a random secret for stronger IP pseudonymization.

## Verification before merging

Run `npm run check`, `npm test`, `npm run build`, plus a browser test: FR and EN, 62 products, multiple cart lines, subtotal/tax/points, create order, share link on a second device, status progression, reload and expiration. Confirm 429 rate limiting, invalid token 404, no live orders or loyalty writes. Check logo fidelity. Do not claim these tests passed until CI/browser evidence is available.

## Known limitations

The demo offers sample toppings across the catalog; modifier eligibility and surcharge approval are not taken from the official modifier assignment tables. The public staff simulation is token-based, not the operational STAFF panel. The demonstration does not model refunds, discount redemption, real pickup capacity, tax registration, or checkout payment.

## Client-facing presentation

The customer-facing pages use production-style language and the original owner logo, with a concise preview notice instead of repetitive demo terminology. Keep the internal technical demo naming and isolation. Prices, pickup slots, Rewards accrual, and real payments are **not approved or operational** until owner signoff; do not hide this fact from the client. The logo is a tall vector (viewBox 1065 × 1477); display at its natural aspect ratio and verify visually with the owner. The real staff system remains separate.
