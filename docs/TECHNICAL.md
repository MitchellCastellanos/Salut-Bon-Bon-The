# Technical reference

Architecture, configuration, integrations, security, migrations, deployment and tests. Requirements: [PRODUCT_SPEC.md](PRODUCT_SPEC.md). Implementation state and gaps: [PROJECT_STATUS.md](PROJECT_STATUS.md). Tax rationale: [TAX.md](TAX.md). Image slots: [IMAGE_ASSET_MANIFEST.md](IMAGE_ASSET_MANIFEST.md). Decision log: [DECISIONS.md](DECISIONS.md).

## Stack and architecture

Next.js 16 App Router, React 19, strict TypeScript, Tailwind CSS 4, Zod, PostgreSQL (`pg`; PGlite for the credential-free demo), Better Auth, Stripe SDK, `qrcode`, Vitest, Playwright Core. Node.js 24 locally (CI uses Node 22). Versions are pinned in `package.json`. A modular monolith: one Next process plus PostgreSQL; no ORM (Prisma is not used). Read the Next.js guide in `node_modules/next/dist/docs/` before changing framework-level code (see `AGENTS.md`).

- **Rendering.** Localized routes under `app/[lang]/…`. `proxy.ts` sets `x-salut-lang`/`x-salut-path` headers and redirects `/fr/admin*` and `/fr/staff*` to `/en/…`. Admin/staff pages use their own frame (`console-shell.tsx`, `console-sidebar.tsx`).
- **Orders.** The menu client keeps the cart on the device and calls a server action; `src/orders.ts` reprices in integer cents from approved variants, stores a bilingual snapshot and the first event atomically, and enforces idempotency (request UUID plus fingerprint) and slot capacity. Tracking reads a minimal projection by a random 256-bit bearer token. State machine in `src/domain.ts`: RECEIVED → CONFIRMED → PREPARING → READY → COMPLETED, CANCELLED from active states; completion needs settled payment; a card order cannot be confirmed before Stripe settles it; cancelling a paid card order sets `REFUND_REQUIRED` (flag only).
- **Staff authority.** Every staff page and action resolves the Better Auth session **and** reads the role from PostgreSQL (`src/staff.ts`), so demotion applies to existing sessions.
- **Realtime.** Tracking and staff refresh every 5 s via polling; PostgreSQL is authoritative.
- **Payments.** `src/card-checkout.ts` + `src/providers/stripe.ts` + `src/payments.ts` + `app/api/stripe/webhook/route.ts`.
- **Email.** `src/notifications.ts` (outbox `email_outbox`, daily retry `app/api/notifications/run`), `src/account-email.ts` (verification, reset).
- **Loyalty.** `src/loyalty.ts`, `src/rewards-math.ts`, `src/guest-card.ts`, `src/stamp-progress.tsx`, SQL functions below.
- **Counter sales.** `src/counter.ts`, `/staff/counter`.
- **Catalog/pricing.** `src/catalog*.ts`, `catalog/official.json`, `src/catalog-display-prices.ts` (display fallback; see PROJECT_STATUS risks).
- **Interfaces.** Next server actions are internal. External HTTP surface: `POST /api/stripe/webhook`, `GET /api/notifications/run` (cron, `CRON_SECRET`), `/api/demo-orders` (isolated demo, below), `robots.txt`, `sitemap.xml`, Open Graph image.

## Routes

| Area | Routes |
| --- | --- |
| Public | `/{fr,en}`, `/menu`, `/catalog`, `/catalog/[collection]`, `/catalog/products/[id]`, `/track/[token]` (+ `/receipt`), `/legal/[document]`, `/demo-commande` · `/demo-order` (isolated demo) |
| Rewards | `/fr/recompenses`, `/en/rewards` (public terms), `/fr/recompenses/carte`, `/en/rewards/card` (guest card) |
| Customer | `/account`, `/account/rewards`, `/account/verify`, `/account/reset` |
| STAFF + ADMIN | `/staff` (orders), `/staff/counter`, `/staff/rewards` (scan, award, redeem) |
| ADMIN only | `/admin` (dashboard), `/admin/catalog`, `/admin/prices`, `/admin/hours`, `/admin/business`, `/admin/customers` (+ `/[id]`), `/admin/rewards`, `/admin/analytics`, `/admin/campaigns`, `/admin/team` |

The public header's **Order** button points to the isolated demo, not the real menu pickup section; real orders use `/menu`.

## Database and migrations

PostgreSQL is the only store. SQL lives in `db/NNN-*.sql`, applied in order by `scripts/migrate.mjs` (one transaction per file, advisory lock, checksum ledger `schema_migrations`; a changed applied file aborts). Migrations never run at build or request time. **Applied migrations are history: never edit them; add a new numbered file.**

| # | Content |
| --- | --- |
| 001 | `orders`, `order_events`; request UUID and fingerprint; 256-bit tracking token |
| 002 | Better Auth tables (`user`, `session`, `account`, `verification`), roles CUSTOMER/STAFF/ADMIN (its own BEGIN/COMMIT was removed so the runner owns the transaction) |
| 003 | Catalog: categories, products, translations, variants, modifier groups/eligibility, collections, images, campaigns, events, store settings, audit history |
| 004 | `orders.tax_cents` |
| 005 | `payment_attempts`, `provider_events`, `email_outbox`, `orders.customer_email`, `payment_method`, payment states |
| 006 | `orders.customer_user_id`, `rate_limits`, loyalty tables (`loyalty_program`, `loyalty_rewards`, `loyalty_accounts`, `loyalty_transactions`, `loyalty_qr_tokens`), functions `loyalty_post`, `loyalty_redeem` |
| 007 | Append-only history: revokes plus trigger on `loyalty_transactions` |
| 008 | `orders.tax_breakdown`, `orders.business_snapshot` |
| 009 | Loyalty lifecycle flags, guest cards, refund events and reversal, `loyalty_link_guest`, 10-argument `loyalty_post`; seeded the **superseded** points preview |
| 010 | `orders.channel`, `counter_tender`, `created_by` (counter sales) |
| 011 | Stamp card: clears preview balances through the ledger (aborts if commercially authorized and balances exist), withdraws `rabais-5`, adds reward `free-drink` costing 9. No schema change; `points_per_dollar` kept but unused |

Other SQL: `db/import-catalog.sql` (catalog data), `db/seeds/business-initial.json` (profile seed). `db/manual-client-prices-2026-11-18.sql` is **not a migration** (no number, never run by the runner): it updates regular prices and assigns every modifier to every product. Its header says it was applied to Neon production on 2026-11-18, which matches the 124 priced variants found there on 2026-11-20 even though older docs said no prices existed. The `demo_orders` table used by `/api/demo-orders` has no DDL in this repository.

Integrity guarantees: the runtime role has no DDL and no UPDATE/DELETE on `loyalty_transactions`, `order_events`, `catalog_audit_history`, `provider_events` (migration 007), and no DELETE on orders and payment tables. Every balance change goes through PL/pgSQL functions that lock the account row (`loyalty_post`, `loyalty_redeem`, `loyalty_reverse_refund`, `loyalty_link_guest`). Business, fiscal and pickup settings live in `catalog_store_settings` (`business_profile`, `fiscal_settings`, `pickup_policy`, `pickup_checkout_enabled`).

## Loyalty engine and customer accounts

- **Accounts.** A second Better Auth instance (`customerAuth()` in `src/auth.ts`) with cookie prefix `salut-customer`, mandatory verified email, 12-character passwords, 14-day sessions and a hook that refuses STAFF/ADMIN identities; the staff instance refuses non-staff. Better Auth's HTTP handler is **not** mounted; flows are server actions. Verification is a button (so mail scanners cannot consume the link); verification and reset links last 1 hour; responses never reveal whether an address exists. Registration is offered only when verification email can be delivered, unless `SALUT_INSTANT_ACCOUNTS=1` (below).
- **Ledger.** One stamp is one unit of `loyalty_accounts.balance`; the free drink is reward `free-drink` costing 9 (`stampsForReward` in `src/rewards-math.ts`; cap `maxStampsPerOrder = 10` is a placeholder). `earnForOrder` runs when STAFF mark an order COMPLETED (key `earn:order:<n>`, unique index). `awardInStore({ drinks })` handles counter visits. Idempotency keys reject replays and the same key with different values; suspended accounts cannot earn or redeem; balance can never go negative.
- **Redemption code.** `issueQr` creates a random 32-byte token (SHA-256 at rest, 5 minutes, single use, supersedes the previous one) rendered by `app/[lang]/account/actions.ts` as a QR whose payload is only `https://<site>/{lang}/staff/rewards?t=<token>`; current QR options are error correction **M** and margin 1, with no logo. Staff open the link (staff sign-in required), identification does not consume the token, and **Confirm redemption** consumes it atomically with a per-render idempotency key.
- **Rate limits** (`src/rate-limit.ts`, PostgreSQL fixed windows, hashed subjects): register 5/h per IP and 3/h per email; sign-in 20/15 min per IP and 8/15 min per email; forgot-password 5/h/IP and 3/h/email; reset 10/h/IP; QR issuance 20/10 min per customer; guest-card restore 10/15 min; card creation 5/h; linking 10/h; staff redeem 30/min and award 60/min; checkout 60/min (single shared counter).
- **Refunds.** ADMIN records a pre-tax refund against an earning order; stamps kept = `floor(earned × remaining ÷ eligible)`, cumulative and drift-free, shortfall recorded. Nothing links Stripe refunds to this automatically.
- **Guest cards.** `loyalty_accounts.user_id` null, `guest_secret_hash`, backup code; `loyalty_link_guest` merges into an account via two ledger adjustments and marks the card `merged`.
- **Program states.** `active` is the master switch; preview visibility, earning, redemption and commercial authorization are separate flags. In production (`VERCEL_ENV=production`) activation also needs the recorded authorization (who/when). Every program, reward and account change writes `catalog_audit_history`.

## Environment configuration

Never commit real values. Per-environment secrets, never shared between Vercel targets.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Runtime connection (Neon pooled host, role `salut_app`). Unset means the PGlite demo, which is refused when `VERCEL_ENV` is `production` or `preview` unless `SALUT_ALLOW_DEMO=1` |
| `MIGRATION_DATABASE_URL` | Owner role, **direct** host, trusted machine only |
| `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET` | Exact browser origin (HTTPS except loopback) and a random 32+ character secret; without them sign-in shows as unavailable |
| `SITE_URL` | Authorized absolute origin (canonical, sitemap, QR and Stripe return URLs) |
| `SALUT_STRIPE_TEST_ENABLED=1`, `STRIPE_SECRET_KEY` (`sk_test_…`), `STRIPE_WEBHOOK_SECRET` | Card payment in TEST. LIVE additionally needs `STRIPE_MODE=live`, an `sk_live_` key and `SALUT_LIVE_PAYMENTS_APPROVED=1`: **do not set without owner approval** |
| `RESEND_API_KEY`, `RESEND_FROM`, `STORE_NOTIFICATION_EMAIL`, `CRON_SECRET` (≥32 chars) | Email. Test: `SALUT_RESEND_TEST_ENABLED=1` and `RESEND_TEST_RECIPIENT` (others recorded SKIPPED). Live: `RESEND_MODE=live` and `SALUT_LIVE_EMAIL_APPROVED=1` |
| `SALUT_INSTANT_ACCOUNTS=1` | New customers are pre-verified with no email. Honoured in every environment including production. Rehearsal only: while on, anyone can register an address they do not own. **Remove once Resend works** |
| `SALUT_ANALYTICS_ENABLED=1` | First-party opt-in analytics |
| `INSTAGRAM_URL` | Verified official profile; link hidden until supplied |
| `SALUT_EMAIL_CAPTURE_DIR` | Test hook writing account emails to files; ignored in Vercel production/preview |
| `DEMO_DATABASE_URL`, `DEMO_RATE_SALT` | Isolated demo only; never the live `DATABASE_URL` |
| `SALUT_DATA_DIR`, `STAFF_PASSWORD`, `SESSION_SECRET` | Credential-free local demo only (PGlite folder, shared staff password `salut-demo`, signed demo cookie); inert when a database is configured |

Apple Wallet will add Pass Type ID and WWDR certificates, a signing key and passphrase and the Apple team id as server-only secrets (not yet defined).

## Staff, ADMIN and team provisioning

1. Migrate a database, set `DATABASE_URL`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `SITE_URL`.
2. Create the first ADMIN on a trusted machine, password on stdin:

   ```bash
   read -rs ADMIN_PW
   printf '%s' "$ADMIN_PW" | npm run staff:create -- ADMIN you@example.com "Your name"
   unset ADMIN_PW
   ```

3. Then ADMIN manages everyone at `/admin/team`: create STAFF/ADMIN, promote, demote, replace a password, remove. The last ADMIN can never be demoted or removed, nobody can change their own access, and role changes, password replacement and removal end sessions immediately and are audited.

Counter sales are priced and taxed on the server exactly like online orders, stored as `COUNTER`, paid and completed, attributed to the staff member, outside pickup capacity, and need a chosen tax status. A Rewards customer may be linked by code or email.

## Integrations

| Integration | Behavior | Prerequisite |
| --- | --- | --- |
| Stripe Checkout | Session created server-side per order (idempotency key `salut-checkout:<n>`, 30-minute expiry); items plus a tax line must equal the stored total or the order is cancelled and the slot released. Webhook `/api/stripe/webhook` handles `checkout.session.completed`, `async_payment_succeeded`, `async_payment_failed`, `expired`; verifies signature, mode, amount, currency and reference; deduplicates in `provider_events`; returns 503 for unknown sessions so Stripe retries. Success redirect returns to the home page, not to tracking | Test keys and webhook secret. **Not built:** refund API, Stripe Tax, saved cards. Webhook host must bypass Vercel SSO protection |
| Resend | Outbox with one row per (order, kind), Resend idempotency keys, retried by the daily cron (max 5 attempts). Templates are code, not admin-editable | Verified sender domain, API key |
| Twilio | Not implemented | Consent, number, registration |
| Apple Wallet | Not implemented | See PRODUCT_SPEC |
| Neon | Project `salut-bon-bon-the`, region `aws-us-east-1` (no Canadian region), Postgres 17, database `salut` | See below |
| Vercel | Preview behind SSO uses Neon `development`; Production uses the Neon `production` branch (verified 2026-11-20, see PROJECT_STATUS) and fails closed without `DATABASE_URL` | Domain, env vars per target |

## Neon

Branches: `production` (default; read-only check on 2026-11-20: migrations 001–011 applied, 1 ADMIN, 0 customers, 0 orders, 62 products, 124 priced variants), `development` (previews and QA), `migration-test` (disposable rehearsal), plus a dedicated demo branch. Roles are per branch: `salut_owner` (DDL, direct host, never on Vercel) and `salut_app` (runtime, pooled host, `SELECT/INSERT/UPDATE/DELETE` on catalog and marketing tables, no DELETE on orders and payments, append-only history, no DDL, no access to `schema_migrations`). Create `salut_app` on a branch with its own password before deploying to it. Neon keeps 6 hours of point-in-time history (`history_retention_seconds` 21600); raise before launch if the plan allows.

```bash
MIGRATION_DATABASE_URL=<owner, direct host> npm run db:status
MIGRATION_DATABASE_URL=<owner, direct host> npm run db:migrate
MIGRATION_DATABASE_URL=<owner, direct host> node scripts/import-catalog.mjs   # idempotent
```

A database with the schema but no ledger needs `--baseline=NNN` after verification. Catalog import (migrations through 004 first): rerunnable, preserves admin edits, `--verify-local` checks it on ephemeral PGlite; expect 62 products, 52 codes, 124 translations, 18 modifiers, 7 categories. Availability defaults to false; bulk price updates accept a JSON array of up to 124 product/size pairs (`id`, `size`, `price`, `promo`, `approved`, `available`, whole cents).

**Production procedure (requires owner approval):** confirm CI green; create a `pre-release-YYYYMMDD` branch from `production`; create `salut_app`; set pooled `DATABASE_URL` in Vercel Production only; run `db:status`, `db:migrate`, import with the owner role; create ADMIN users; enter prices, hours, capacity and tax in `/admin` with `pickup_checkout_enabled` off; deploy, smoke test, and enable checkout only after the readiness gates. Rollback: promote the previous Vercel deployment; restore the Neon branch only for data corruption; migrations are additive and there are no destructive down-migrations. The agent sandbox cannot open direct TCP to Neon; the Neon MCP `run_sql` was used with the same SQL and checksums, and a networked `db:status` should confirm the ledger.

Business initialisation: `npm run business:init` writes the owner-supplied profile once (`INSERT … ON CONFLICT DO NOTHING`, never overwrites, `-- --print-sql` prints it, `-- --with-hours` applies the schedule only if none exists). Seed values: Salut Bon Bon Thé, 1175 Rue Notre Dame, Lachine QC H8S 2C5, +1 514-637-6666 (owner-supplied, unverified), Google Place ID `ChIJNRlHTYMXyUwRdKR_YXvuGHA`. Supplied hours (Mon–Sat 10:30–20:00, Sun closed) are deliberately not applied: a third-party page lists Mon–Thu 11:00–20:00, and no public source confirmed the phone.

## Deployment

- `vercel.json` defines one cron: `/api/notifications/run` daily at 13:00 UTC.
- `next.config.ts`: `images.unoptimized: true` (every file in `public/` is a final-size WebP; avoids Vercel optimizer 402 limits), `pg` and PGlite are external packages, `db/*.sql` is traced.
- Fails closed: `src/db.ts` refuses demo storage in Vercel production/preview without `DATABASE_URL`; production never serves fictional products.
- Observability: Vercel deployment and runtime logs; the webhook logs `stripe amount mismatch` and `stripe webhook failed` with ids only.
- Custom domain, DNS and legal copy are not done.

## Security

Controls in place:

- Bearer tracking links return a narrow projection, are `noindex` and `no-referrer`. Checkout validates and reprices on the server.
- Payment truth comes only from `applyStripeEvent` after signature and mode verification; amount, currency and order reference must match; events deduplicate atomically.
- Identity separation (customer vs staff instances), role re-read on every staff request, no public auth handler, enumeration-safe responses, PostgreSQL rate limits, append-only audit/ledger, least-privilege DB role, HTML-escaped email, test-mode email recipient lock, constant-time cron secret comparison (secrets under 32 characters rejected), and ADMIN activation gates.
- Server actions rely on Next.js origin checks for CSRF (no separate token).

Open items: edge rate limits and bot protection (Vercel Firewall) for checkout and staff sign-in, lockout beyond rate limits, account deletion/export tooling and privacy copy, Québec privacy (Law 25) and CASL review, a dependency review of `qrcode`, and picomatch advisory GHSA-fc5q-39xc-vjpf (`<=4.0.7`, no patched release; reachable only through Vitest/Vite tooling, not application code or the build output; CI fails only on critical advisories; re-check after each dependency update). The platform has had no legal or external security review. `SALUT_INSTANT_ACCOUNTS=1` in production and a production ADMIN password shared in chat (change it) are listed in PROJECT_STATUS.

## Demo isolation

`/fr/demo-commande` and `/en/demo-order` plus `/api/demo-orders` form an isolated demonstration: `POST` creates a row in `demo_orders` on `DEMO_DATABASE_URL` (a dedicated Neon branch) and never touches real orders, loyalty or payments; the server reprices from `catalog_variants` there; private id and token (SHA-256 at rest) allow cross-device tracking and status simulation; rows expire after 7 days; 20 creations per hour per pseudonymous IP hash; no emails, accounts or Stripe calls. The shared token grants both tracking and simulation, so it is a demo capability link and not staff authentication. It shows stamps (not points). Sample toppings ignore the real eligibility tables.

## Testing

```bash
npm ci
npm run check        # next typegen, tsc --noEmit, eslint
npm test             # vitest (PGlite in memory)
npm run build
```

`TEST_DATABASE_URL=<disposable migrated PostgreSQL> npm test` also runs the real-PostgreSQL suites (`tests/loyalty-concurrency.test.ts`, `tests/pickup-capacity.test.ts`, `tests/counter.test.ts` and others that skip without it). Prepare the database with `node scripts/migrate.mjs` and `node scripts/import-catalog.mjs`; CI does this with a `postgres:16` service container and also runs `npm audit --omit=dev --audit-level=critical`. Run tests only against disposable databases, never production.

Browser suites need a built app, `CHROMIUM_PATH` and, except the demo suite, a disposable migrated database:

| Command | Covers | Needs |
| --- | --- | --- |
| `npm run test:browser` | Credential-free demo storefront and fulfillment | App without `DATABASE_URL` on port 3100, isolated `SALUT_DATA_DIR` |
| `node tests/catalog-browser-smoke.mjs` | Catalog, campaigns, modifiers, snapshots | `CATALOG_SMOKE_DATABASE_URL`, `CATALOG_SMOKE_BASE_URL` |
| `npm run test:staff` | Role denial and transitions | `STAFF_SMOKE_DATABASE_URL`, `STAFF_SMOKE_BASE_URL` |
| `npm run test:rewards` | Accounts, rewards, hours, menu | `E2E_DATABASE_URL`, `E2E_MAIL_DIR`, ADMIN `admin@example.invalid` and STAFF `staff@example.invalid` fixtures, app with `SALUT_EMAIL_CAPTURE_DIR`, auth vars and `SITE_URL` on one origin |
| `npm run test:rewards-public` | Public rewards page and guest card at 390 and 1280 px | After `test:rewards`; build made with `SITE_URL` set |
| `npm run test:storefront` | Images, links, structure on 14 pages | Running official-catalog app and `SMOKE_BASE_URL` |
| `node tests/instant-journey-smoke.mjs` | Customer → order → staff → team | `SALUT_INSTANT_ACCOUNTS=1`, open checkout |
| `node tests/admin-complete-smoke.mjs` | Dashboard, navigation, counter sale, customers | Same fixture |
| `npm run assets:check` | Image manifest versus files | – |

When a suite restarts its server, stop the old `next-server` first or a stale build answers ("Invalid Server Actions request"). Test inventory in `tests/`: unit and integration (`orders`, `payments`, `providers`, `pickup-policy`, `pickup-capacity`, `tax`, `business`, `loyalty`, `loyalty-concurrency`, `rewards-stamps`, `rewards-permissions`, `rewards-public`, `stamp-migration`, `stamp-progress`, `counter`, `team`, `instant-accounts`, `db-guard`) and the browser scripts above. Results for the current commit are in PROJECT_STATUS; no test exists for QR scanning, Wallet or Stripe against a real Stripe test session.
