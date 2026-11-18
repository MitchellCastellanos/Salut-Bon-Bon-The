# Launch readiness

Production checkout stays disabled until hosted validation and owner sign-off. This handoff covers the commercial implementation on `feat/official-catalog-neon-marketing`.

## Completed and verified locally

- [x] Searchable French and English catalog with 62 products, 124 product translations, 18 modifiers, collection pages, and four campaigns.
- [x] Better Auth STAFF and ADMIN authorization, server-side role checks, ADMIN catalog and campaign editing, and staff order fulfillment.
- [x] Pay-at-pickup checkout with approved server-side pricing, tax calculation, price-change reconfirmation, atomic slot capacity checks, and private tracking.
- [x] Opt-in first-party campaign analytics and ADMIN reporting.
- [x] Migrations 001–004 and repeated catalog import against a disposable PGlite PostgreSQL-wire fixture. Demo, staff authorization, and commercial browser smokes passed during implementation. Final handoff verification passed ESLint, TypeScript, eight automated tests, and the production build.

## Verified 2026-11-18 (branch `claude/salut-bon-bon-the-launch-6a36qh`)

- [x] Neon project `salut-bon-bon-the` with `production` (empty), `development`, `migration-test`; migrations 001–005 and the catalog import rehearsed on Neon; import idempotent; rollback verified; least-privilege `salut_app` role. See [Neon setup](NEON_SETUP.md).
- [x] Vercel Preview uses the Neon `development` branch (Preview-only sensitive variable). A preview served Mango Series products read from Neon. Production has no database variable and refuses demo storage.
- [x] Stripe Checkout (test mode), signed webhook, idempotent reconciliation, expiry slot release, refund-required flag. 12 reconciliation tests plus a live Neon run of the same SQL under the runtime role.
- [x] Resend transactional email (FR/EN, outbox, retries, test-recipient guard). Not sent to any real address.
- [x] Exceptional closures, staff order search, payment-aware order states, paid-before-confirm and paid-before-complete guards.
- [x] 25 automated tests, `npm run check`, `npm run build`, demo browser smoke.

## Blocked on the owner or external systems

- [ ] Owner-approved prices, hours, capacity, closures, lead time. **None exist; the catalog has no prices, so nothing is orderable.**
- [ ] GST/QST registration status, numbers and per-product treatment ([Tax](TAX.md)).
- [ ] Stripe test keys and webhook secret in Vercel Preview; later live keys plus `SALUT_LIVE_PAYMENTS_APPROVED=1` after explicit approval.
- [ ] Resend verified domain/sender, `RESEND_API_KEY`, `STORE_NOTIFICATION_EMAIL`, `CRON_SECRET`.
- [ ] Production Neon: create `salut_app`, run migrations and import (owner approval), create ADMIN users.
- [ ] Better Auth variables (`BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`) per environment. Not set on Vercel.
- [ ] Photography: 0 of 27 assets exist ([manifest](IMAGE_ASSET_MANIFEST.md)).
- [ ] Legal and privacy copy, analytics consent review, custom domain and DNS (not touched).
- [ ] Edge rate limits for checkout and staff sign-in (Vercel Firewall).

## Not tested (state plainly)

- Concurrent slot-capacity race against real Postgres (the code uses `pg_advisory_xact_lock`; no concurrent test was executed).
- `scripts/migrate.mjs` itself against Neon (sandbox cannot open Postgres sockets; equivalent SQL was run through Neon's SQL API).
- Real Stripe session creation and a real signed webhook from Stripe (no keys). Signature verification is covered with generated test signatures.
- Real Resend delivery.
- Authenticated admin and staff flows on the preview (Better Auth not configured there).
- Responsive and accessibility re-run on the changed checkout form; only the demo browser smoke was re-run.
- Twilio: not implemented.
