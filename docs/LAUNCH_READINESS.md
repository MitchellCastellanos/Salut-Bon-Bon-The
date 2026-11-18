# Launch readiness

Production checkout stays disabled until hosted validation and owner sign-off. This handoff covers the commercial implementation on `feat/official-catalog-neon-marketing`.

## Completed and verified locally

- [x] Searchable French and English catalog with 62 products, 124 product translations, 18 modifiers, collection pages, and four campaigns.
- [x] Better Auth STAFF and ADMIN authorization, server-side role checks, ADMIN catalog and campaign editing, and staff order fulfillment.
- [x] Pay-at-pickup checkout with approved server-side pricing, tax calculation, price-change reconfirmation, atomic slot capacity checks, and private tracking.
- [x] Opt-in first-party campaign analytics and ADMIN reporting.
- [x] Migrations 001–004 and repeated catalog import against a disposable PGlite PostgreSQL-wire fixture. Demo, staff authorization, and commercial browser smokes passed during implementation. Final handoff verification passed ESLint, TypeScript, eight automated tests, and the production build.

## Verified (branch `claude/salut-bon-bon-the-launch-6a36qh`, PR #4)

- [x] Neon project `salut-bon-bon-the`: `production` (empty, untouched), `development` and `migration-test` with migrations 001–007; catalog import idempotent; `salut_app` least-privilege role with append-only history. See [Neon setup](NEON_SETUP.md).
- [x] Customer accounts (register, verify, sign in/out, reset, profile, order history) on a separate Better Auth instance; staff/admin separation verified in the browser. See [Rewards](REWARDS.md).
- [x] Récompenses Salut: inactive by default, ADMIN-configurable, atomic idempotent engine, single-use QR identification and redemption, audited adjustments. Concurrency verified on real PostgreSQL.
- [x] Menu: 7 category tiles, 62 official products × 2 languages, customization, cart with quantity −/+ and remove, pickup checkout; no placeholder text.
- [x] Photography integrated and audited: homepage hero carousel (Mango, Crème Brûlée, House Lemonade) with working links, image-led campaign cards, collection banners, 9 product photos, pickup/rewards tiles, gallery; no broken images or overflow at 1280 px and 390 px in FR and EN; images served directly from the static CDN, with no dependency on Vercel's image-optimization quota (`npm run test:storefront`).
- [x] ADMIN price sheet, visual business-hours editor with exceptional schedules and pickup settings, enforced server-side. See [Scheduling](SCHEDULING.md).
- [x] Stripe (test mode) reconciliation, Resend outbox, tax logic, as before.
- [x] 47 automated tests (7 need a PostgreSQL), lint and types clean, production build, and four browser suites (demo, catalog, staff authorization, and the new rewards/accounts/hours/menu suite, also run with the app connected as the least-privilege role).

## Blocked on the owner or external systems

- [ ] Owner-approved **prices** (the catalog has none; only the price sheet can make products orderable), **hours**, **capacity**, **lead time**, and loyalty **earning rate, reward list and thresholds**. Nothing was invented.
- [ ] GST/QST registration status, numbers and per-product treatment ([Tax](TAX.md)).
- [ ] Stripe test keys and webhook secret; live keys only with explicit approval.
- [ ] Resend verified domain, API key, `STORE_NOTIFICATION_EMAIL`, `CRON_SECRET`. **Customer registration stays unavailable until email is configured** (by design).
- [ ] `BETTER_AUTH_URL` and `BETTER_AUTH_SECRET` per Vercel environment (not set; accounts and staff sign-in show an accurate unavailable state until they are).
- [ ] Production Neon: create `salut_app`, run migrations 001–007 and the import (separate approval), create ADMIN users.
- [ ] **Official logo** (`public/brand/logo.svg`, plus `public/brand/logo-email.png` for email) and the 3 BATCH-06 rewards/account images ([manifest](IMAGE_ASSET_MANIFEST.md)). The 26 marketing and product images are present and verified (uploaded to `main`, 27 files including one unused extra). Logo and BATCH-06 slots are wired and fall back (wordmark, or nothing) until the files exist.
- [ ] Legal and privacy copy (customer accounts and loyalty data), analytics consent review, custom domain and DNS (not touched).
- [ ] Edge rate limits for checkout and staff sign-in (Vercel Firewall) as defence in depth.
- [ ] Twilio SMS: not implemented (optional, not a launch blocker).

## Not tested (stated plainly)

- Scanning the QR with a physical phone camera. The QR payload and the staff page were tested separately; the SVG was not decoded by a scanner.
- Real Stripe sessions and signed webhooks, and real Resend delivery (no credentials). Account emails were exercised through the non-deployed file-capture hook.
- Mobile-width rendering of the account, rewards, hours-editor and price-sheet pages (the storefront, campaign, catalog and account pages were audited at 390 px; the admin screens and the QR card were not). No assistive-technology or contrast tooling was run; accessibility checks are structural (one h1, alt text, labels, names, language).
- Authenticated flows on the Vercel preview (no auth variables there).
- Concurrency on Neon itself (it ran on local PostgreSQL 16; the Neon branches were verified with sequential SQL).
- GitHub Actions has not run the new Postgres-backed CI job yet.
