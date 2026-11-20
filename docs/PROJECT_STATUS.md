# Project status

**Audit date: 2026-11-20**, commit base `main` @ `fd93a18` plus the scope documents of branch `docs/salut-plus-demo-scope-2026-11-20`. This is the only document that says what is built. Statuses are **IMPLEMENTED / PARTIAL / ABSENT / BLOCKED** and rest on code, migrations and tests inspected in this audit, never on earlier prose. Requirements: [PRODUCT_SPEC.md](PRODUCT_SPEC.md). Packages: [COMMERCIAL.md](COMMERCIAL.md). Technical detail: [TECHNICAL.md](TECHNICAL.md).

## Verified in this audit

| Check | Result |
| --- | --- |
| `npm ci` | OK |
| `npm run check` (route types, `tsc --noEmit`, ESLint) | Passed, no errors |
| `npm test` | **110 passed, 13 skipped** (18 files; 3 skipped files need `TEST_DATABASE_URL`) |
| `npm run build` | Passed |
| Real-PostgreSQL suites (concurrency, capacity, counter) | **Not run**: no PostgreSQL server in this container. CI runs them with a `postgres:16` service |
| Browser suites, real Stripe, real email, camera scan, iPhone, Vercel preview | Not run |
| Neon `production` branch (read-only counts) | Migrations 001–011 applied; 1 ADMIN, 0 customers, 0 orders, 62 products, 124 priced variants |

## Summary

The project is a working, well-tested pickup-ordering platform with an official 62-product bilingual catalog, server-side pricing and tax, capacity-aware scheduling, individual STAFF/ADMIN accounts, counter sales, customer accounts, a Stripe Checkout integration with webhook reconciliation (test mode), a Resend outbox, and a stamp-card loyalty engine with append-only ledger, guest cards and a single-use redemption QR. Most Plus *server* mechanics exist. What Plus still lacks is the customer-facing finish and several owner controls: **no logo QR, no stable identification token, no Apple Wallet at all, no favorites/reorder, no refund workflow, no notification or audit viewer**, no proof that Stripe and email work against real providers, and open owner rules for loyalty and pricing. Loyalty is correctly inactive and live payment and email are gated off.

Production (Neon `production`) is already migrated through 011 with prices loaded, one ADMIN and no customers or orders. `SALUT_INSTANT_ACCOUNTS=1` was set in Vercel Production on 2026-11-19 (customers can register without email verification) and an ADMIN password was shared in chat; both are risks below.

## Salut Plus feature matrix

| # | Capability | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| 1 | Create account, verify email, sign in/out, reset | **PARTIAL** | `src/auth.ts` (`customerAuth`), `app/[lang]/account/*`, `src/account-email.ts`, `tests/instant-accounts.test.ts`, `tests/rewards-browser-smoke.mjs` | Real email delivery is BLOCKED (no verified Resend domain/key). Production bypasses verification via `SALUT_INSTANT_ACCOUNTS=1` |
| 2 | Catalog with photos and real prices | **PARTIAL** | `catalog/official.json` (62 products), 26 WebP images in `public/`, 124 priced variants in production, `/catalog`, `/menu` | Large-size and matcha prices have no owner source; `src/catalog-display-prices.ts` hard-codes matcha $6.75 and large = regular + $1.00 as a display fallback; see risks |
| 3 | Drink customization: sizes and toppings | **PARTIAL** | `app/[lang]/menu/menu.tsx`, `src/catalog-options.ts`, `db/manual-client-prices-2026-11-18.sql`, `tests/orders.test.ts` | That SQL sets tapioca `max_selections = 1` (a second tapioca cannot be added as a paid extra), forces `available = true` on every modifier and assigns every modifier to every product, none confirmed by the owner. Included-tapioca and +$1 rule otherwise present |
| 4 | Cart and pickup checkout | **IMPLEMENTED** | `src/orders.ts`, `src/pickup-policy.ts`, `app/[lang]/menu/actions.ts`, `tests/orders.test.ts`, `pickup-policy`, `pickup-capacity` (PostgreSQL), readiness gate in `src/store-settings.ts` | Owner must set lead time and capacity; checkout is off until then |
| 5 | Stripe payment in TEST | **PARTIAL / BLOCKED** | `src/providers/stripe.ts`, `src/card-checkout.ts`, `src/payments.ts`, `app/api/stripe/webhook/route.ts`, `tests/payments.test.ts`, `tests/providers.test.ts` (synthetic signed events) | Never exercised against a real Stripe test session; keys and webhook secret not set (BLOCKED). `success_url` returns to the home page instead of the order. No refund API |
| 6 | Order status and history for the customer | **IMPLEMENTED** | `app/[lang]/account/page.tsx` (*My orders*), `/track/[token]` (+ receipt), `orders.customer_user_id`, 5 s polling | Favorites and reorder: see row 7 |
| 7 | Favorites and reorder | **ABSENT** | No code (grep finds only homepage "favorites" marketing tiles) | Needed for Plus |
| 8 | Staff process the order to completion | **IMPLEMENTED** | `app/[lang]/staff/page.tsx`, `staff/actions.ts`, `src/domain.ts` transitions, ready/cancelled emails, `tests/staff-browser-smoke.mjs` | Search by number/name and status filter exist, but results are capped at 100 with active orders first; no date range; no refund |
| 9 | Stamps for eligible completed orders | **IMPLEMENTED (inactive)** | `src/loyalty.ts` `earnForOrder`, `src/rewards-math.ts`, `db/011-stamp-card.sql`, `tests/rewards-stamps.test.ts`, `stamp-migration`, `loyalty-concurrency` (PostgreSQL) | Program ships inactive by design. Owner rules still open (eligible categories, cap, free-drink ceiling, stacking, expiry) |
| 10 | Digital loyalty card | **PARTIAL** | `src/stamp-progress.tsx`, `app/[lang]/account/rewards`, `src/guest-card-page.tsx` (member and guest) | Card is a progress bar plus a short-lived QR; stamp artwork (BATCH-07) and rewards images (BATCH-06) missing, so SVG fallbacks are shown |
| 11 | QR with official logo centered | **ABSENT** | `app/[lang]/account/actions.ts` renders a plain SVG QR: error correction **M**, margin **1**, no logo. `public/brand/logo.svg` exists (vector, 1065 × 1477) | Build logo QR with level H, quiet zone, backing plate and scan-test evidence |
| 12 | Stable, opaque, revocable identification token | **ABSENT** | Only `loyalty_qr_tokens` (5 min, single use). Member code is deliberately never a credential | New table, lookup, rotation, rate limits (migration 012) |
| 13 | Apple Wallet pass | **ABSENT / BLOCKED** | No `pkpass`, signing, endpoint or dependency anywhere. Mentioned only in docs | Needs Apple Developer account, Pass Type ID and WWDR certificates (BLOCKED) and item 12 |
| 14 | Staff scan, award, redeem securely | **IMPLEMENTED** (scanner UX PARTIAL) | `app/[lang]/staff/rewards/*`, `lookupQr`, `redeemReward`, `loyalty_redeem`, rate limits, idempotency keys, ledger actor. Anonymous/customer denial in `tests/rewards-permissions.test.ts` | Scanning relies on the phone's camera opening a URL or pasting it; no in-page camera scanner, no external-scanner/manual-ID mode, no scan test with real devices |
| 15 | Reward redemption and earn history for customers | **IMPLEMENTED** | `accountHistory`, `/account/rewards`, `/admin/customers/[id]` | – |
| 16 | Refunds | **PARTIAL** | Loyalty reversal `reverseForRefund` + `/admin/rewards`; cancelling a paid card order sets `REFUND_REQUIRED` | No Stripe refund call, no refund screen or queue; manual in the Stripe dashboard |
| 17 | Automated notifications | **PARTIAL** | `src/notifications.ts` (4 kinds, FR/EN, outbox, retries), `tests/providers.test.ts` | Test/live gates only; no template editing, no delivery log or failure view, cron runs once a day, never sent for real; no stamp-earned or card notices |
| 18 | Basic analytics | **PARTIAL** | `/admin/analytics` (opt-in first-party events, campaign breakdown) and sales cards on `/admin` | No product, loyalty participation or redemption reporting; off unless `SALUT_ANALYTICS_ENABLED=1` |
| 19 | Package entitlements (Essential/Plus/Premium) | **ABSENT** | No gating code | Product decision; not required for the demo |
| 20 | Live-activation gates | **IMPLEMENTED** | Stripe/Resend modes in `src/providers/stripe.ts` and `src/notifications.ts`, demo storage guard `src/db.ts`, loyalty authorization flag, checkout readiness gate | – |

## Admin coverage

Admin checklist numbers refer to [PRODUCT_SPEC.md](PRODUCT_SPEC.md#admin-requirements-for-salut-plus). Server-side roles are enforced on every admin page and action (`staffRole()`; `/admin/*` is ADMIN only, `/staff*` is STAFF or ADMIN). All admin writes of catalog, prices, hours, business, rewards and team go to `catalog_audit_history`.

| # | Area | Status | What exists | What is missing |
| --- | --- | --- | --- | --- |
| 1 | Overview | **PARTIAL** | `/admin`: readiness blockers, sales today / 7 days online / counter, area cards | No counts by order status, no "needs attention" list (stuck orders, `REFUND_REQUIRED`, failed emails), no last-updated stamp |
| 2 | Orders | **PARTIAL** | `/staff` queue, transitions, pickup payment, cancel, counter sales; per-order events | No order history beyond the latest 100 or date filter, no order detail page, no refund/cancellation workflow with reason, no staff attribution display |
| 3 | Catalog | **PARTIAL** | `/admin/catalog` edit categories, collections, modifiers, products, eligibility; `/admin/prices` price sheet, offered flag, bulk JSON; `/admin/campaigns` | Cannot **create** products, categories or sizes; no delete; no stock-out shortcut; no preview before publish; image is a path string, no upload |
| 4 | Store and pickup | **IMPLEMENTED** | `/admin/hours` (weekly, exceptions, slot, lead time, capacity, cutoff, pause switch, 21-day preview); `/admin/business` profile | No customer-visible notice banner |
| 5 | Payments and taxes | **PARTIAL** | Fiscal settings, GST/QST, receipts (`/admin/business`) | No Stripe readiness/mode panel, no payment or reconciliation list, no refund status |
| 6 | Customers | **PARTIAL** | `/admin/customers` list and detail (orders, ledger) | No account status control outside rewards, no privacy export or delete |
| 7 | Rewards rules | **IMPLEMENTED** | `/admin/rewards`: states, rules, rewards, adjustments with reason, suspension, refund reversal, lookup; `/staff/rewards` | Free-drink ceiling and stacking are not modeled; expiry not modeled |
| 8 | Wallet and QR | **ABSENT** | – | Everything |
| 9 | Notifications | **ABSENT (admin)** | Sending only | Templates, preview, provider status, delivery log, resend |
| 10 | Analytics | **PARTIAL** | See matrix row 18 | Reports for products and loyalty |
| 11 | Staff and access | **PARTIAL** | `/admin/team` full lifecycle with last-admin protection, immediate session end | No audit-log viewer (history is written but unreadable in the UI), no sign-in diagnostics |
| 12 | Content and settings | **PARTIAL** | Campaigns, business profile, hours | No editor for homepage copy, SEO text, rewards copy or legal pages (code-defined) |

ADMIN versus STAFF is clean in code: STAFF reach orders, counter sales and card scan; everything under `/admin` is ADMIN only; secrets, certificates, migrations and Stripe/Resend keys are environment-only and not exposed in any screen.

## Preliminary admin UX/UI findings (no redesign yet)

Findings only; the full audit is a separate later phase.

1. **Orders live under `/staff`, not `/admin`.** The "Orders" navigation entry leaves the admin area and the sidebar context changes. Confusing; consider an admin-framed orders section later.
2. **Product setup is split across four pages** (`/admin/catalog`, `/admin/prices`, `/admin/campaigns` "quick pricing", `/admin/rewards` categories): the same product is edited in three places. Group under one Menu section.
3. **`/admin/catalog` is a long page of one-line forms** with free-text id lists ("Eligible (comma-separated IDs)", "Defaults (IDs)") and image paths; error-prone for a non-developer.
4. **Dashboard shows sales only.** Nothing prompts action (blockers appear only while checkout is closed).
5. **Dormant French strings** (`fr ? … : …`) remain in admin pages and navigation labels despite the English-only rule; they are never displayed but violate the convention for new screens.
6. **Counter sale and card scan appear twice** (sidebar and dashboard cards) with different wording.
7. **No in-product help or defaults.** Settings such as lead time and capacity are blank by design but give no guidance.
8. **Mobile/tablet and accessibility of admin pages untested** (the hours editor and price sheet are dense).
9. **Mixed identifiers.** Raw ids (`milk-tea`, group ids) are shown as labels.
10. **Audit data is invisible**, so owners cannot answer "who changed this price?".

## Risks and corrected documentation conflicts

Findings from reconciling code, Neon and the documents:

1. **Stale production claims fixed.** Older docs said production was empty and unprepared. Verified 2026-11-20: migrations 001–011 applied, 124 priced variants, one ADMIN.
2. **`SALUT_INSTANT_ACCOUNTS=1` is enabled in production.** Anyone can register with an address they do not own and password reset cannot be relied on. Remove after Resend is configured (task R3).
3. **An ADMIN password was shared in chat** (2026-11-19). Change it.
4. **Unconfirmed prices are shown.** `src/catalog-display-prices.ts` invents matcha $6.75 and a +$1.00 large premium; the 124 priced production variants include large sizes with no owner source. Confirm or correct before any public use.
5. **Topping rule is not what the owner stated.** Tapioca is capped at one selection, so a second tapioca cannot be charged as an extra; every modifier is assigned to every product.
6. **`demo_orders` has no DDL in the repo** and `/api/demo-orders` depends on it; the demo cannot be rebuilt from the repository.
7. **QR hardening needed:** error correction M and margin 1 do not meet the quiet-zone and level-H requirement even before adding a logo.
8. **Stripe return URL** sends the customer to the home page, not to their order.
9. **Edge rate limits** for checkout and staff sign-in (Vercel Firewall) not configured.
10. **Documents had contradicted code** (README promoting the 5 % points terms, the loyalty proposal saying option A has no code, status tables saying Stripe was pending, Apple Wallet listed as Premium roadmap). All reconciled in this consolidation; history is in [archive/](archive/).

## Decisions the owner must make

Nothing here has been decided in code or documents.

| # | Decision | Needed for |
| --- | --- | --- |
| D1 | Eligible drinks/categories for stamps (today: all if none selected) | Loyalty activation |
| D2 | Maximum value of the free drink, and whether it can be any size/toppings | Redemption |
| D3 | Maximum stamps per order or visit (10 is a placeholder) | Earning |
| D4 | Stacking with promotions and discounts | Earning/redemption |
| D5 | Stamp expiry (none today) and handling of a refund after redemption | Policy |
| D6 | Whether Wallet/stable QR alone may authorize redeeming, or the short-lived code is also required (recommended: also required) | Security design |
| D7 | Whether online redemption will ever exist (spec: counter only) | Scope |
| D8 | Large-size price differential, matcha price, which toppings apply to which drinks, second-tapioca treatment | Pricing and checkout |
| D9 | Lead time and per-slot capacity; confirmed opening hours (supplied Mon–Sat 10:30–20:00 conflicts with a third-party Mon–Thu 11:00–20:00) | Opening checkout |
| D10 | GST/QST legal name and numbers (or non-registration), accountant's answer on a certified sales recording system | Tax and receipts |
| D11 | Confirm business address and phone (unverified) | Profile and structured data |
| D12 | Signed commercial proposal: package prices, reference prices, maintenance, Apple Developer ownership, recurring costs and fees | Contract |
| D13 | Loyalty commercial authorization and launch date | Production activation |
| D14 | Privacy and consent copy for accounts, loyalty and analytics; retention | Launch |
| D15 | Whether package entitlements must be enforced in code | Premium later |

## External dependencies and blockers

| Dependency | Needed for | State |
| --- | --- | --- |
| Stripe test secret key and webhook secret (Vercel preview) | R2 | BLOCKED |
| Resend verified sending domain, API key, `STORE_NOTIFICATION_EMAIL`, `CRON_SECRET` | R3 | BLOCKED |
| Apple Developer Program account, Pass Type ID, signing certificate, WWDR certificate, team id | R6 | BLOCKED |
| Real iPhone and Android devices for scan and Wallet tests | R5, R6 | Needed |
| Disposable PostgreSQL and Neon preview branch | R1 | Available on Neon, not in this container |
| Owner decisions D1–D15 | See above | Open |
| Stamp artwork (BATCH-07), rewards/account images (BATCH-06), `public/brand/logo-email.png` | Card and email polish | Missing (fall back to SVG/wordmark) |

## Roadmap to finish Salut Plus

Ordered by technical dependency, then priority. Nothing below is started. No Premium features. Reuse the existing ledger, guest cards, outbox and Stripe adapter; no new systems.

**R0 · Owner decisions and credentials (no code).** Resolve D1–D11 as needed for the next tasks, change the shared ADMIN password, request Stripe test keys, Resend domain, Apple Developer credentials. *Acceptance:* each blocker above has an owner and date.

**R1 · Verify the baseline on real infrastructure.** *Exists:* green check/test/build; 13 PostgreSQL tests; CI with Postgres. *Missing:* run of the skipped suites, browser suites and a Vercel preview on an isolated Neon branch. *Files:* none (evidence only; `.github/workflows/ci.yml`). *Risk:* running tests against the wrong database; use disposable branches only. *Tests:* `TEST_DATABASE_URL npm test`, all browser smokes. *Acceptance:* recorded pass/fail list in this file.

**R2 · Pricing and customization correctness.** *Exists:* server pricing, modifier tables, price sheet. *Missing:* owner-approved large/matcha prices, second tapioca as paid extra, per-drink topping eligibility, removal of the invented display fallback. *Files:* `src/catalog-display-prices.ts`, `src/catalog-options.ts`, `src/catalog-pricing.ts`, admin catalog/prices, a new migration (never edit applied ones) for tapioca limits. *Depends on:* D8. *Risk:* wrong prices charged; keep server authority. *Tests:* extend `tests/orders.test.ts` with the official price sheet (every category × size × 0–3 extras). *Acceptance:* displayed, quoted and charged totals match the owner's sheet in FR and EN.

**R3 · Real email and accounts.** *Exists:* outbox, templates, account email, gates. *Missing:* verified domain, removing `SALUT_INSTANT_ACCOUNTS` in production, delivery proof. *Files:* env only, `src/notifications.ts` for a stamp/ready notice if wanted. *Depends on:* R0. *Risk:* mail to real people; keep test recipient lock until approved. *Tests:* sandbox delivery of verification, reset, confirmation, ready; browser journey with real verification. *Acceptance:* register, verify, sign in, reset password end to end with no instant-accounts flag.

**R4 · Stripe TEST end to end.** *Exists:* adapter, webhook, reconciliation, tests with synthetic events. *Missing:* real test session proof, return to the order (`success_url`), failed/expired/duplicate handling on a real session, refund. *Files:* `src/providers/stripe.ts` (success URL to tracking), `src/card-checkout.ts`, `src/payments.ts`; new admin refund action. *Depends on:* R0, R3 for receipts. *Risk:* refund double-issue, live keys; keep mode gates, use idempotency keys, test keys only. *Tests:* Stripe test card success, decline, expiry, replayed webhook, mismatch; refund twice. *Acceptance:* a TEST order is paid, shows paid in history and to staff, cannot duplicate; ADMIN can refund once and stamps reverse.

**R5 · Identification token, logo QR and scanner (migration 012).** *Exists:* single-use redemption token, guest cards, staff lookup, `qrcode`. *Missing:* the stable token (spec in PRODUCT_SPEC), revocation/rotation, short payload, level-H logo QR with quiet zone, camera/manual scanner mode. *Files:* new migration and `src/identification.ts`, `app/[lang]/account/actions.ts` and `qr-card.tsx`, `app/[lang]/staff/rewards/*`, `src/guest-card-page.tsx`. *Depends on:* D6. *Risk:* leaked stable QR; staff-only lookup, uniform not-found, rate limits, redemption still needs confirmation and the short code, audit. *Tests:* unit (derivation, revoke), PostgreSQL concurrency, denied anonymous/customer, repeated scans award once, scan matrix on iPhone, Android and a scanner at several distances/brightness to choose the logo size. *Acceptance:* logo as large as scan tests allow with ≥ agreed success rate, revoking an old QR stops it resolving.

**R6 · Apple Wallet.** *Exists:* nothing. *Missing:* signed `.pkpass`, download endpoint, pass-update web service, revoke/reissue. *Files:* new `src/wallet/*`, `app/api/wallet/*`, account card button, admin wallet panel; a pass library or manual signing. *Depends on:* R5, Apple credentials. *Risk:* certificate/key leakage (server secrets only, never in git or logs); barcode must be the identification token, never the redemption URL. *Tests:* signature validation, pass JSON snapshot, install and scan on a real iPhone, update after a stamp, revoke. *Acceptance:* pass installs on a real iPhone, shows stamps, scans at `/staff/rewards`, stops after revoke.

**R7 · Customer favorites and reorder.** *Exists:* order history with snapshots. *Missing:* favorites storage, reorder that revalidates current menu and price. *Files:* new table (migration), account pages, menu entry. *Risk:* privacy; keep per-user. *Tests:* reorder after a price change and after a product is withdrawn. *Acceptance:* a customer favorites a drink and reorders it at current price.

**R8 · Owner controls that block independent operation.** *Missing:* order detail/search/history and cancel-refund with reason; audit-log viewer; notification log and failed-send retry; Stripe/Resend/Wallet readiness panel (booleans only, no secrets); product/category creation and stock-out toggle; analytics for products and loyalty participation; dashboard order counts and attention list. *Files:* new pages under `app/[lang]/admin/*` reusing existing tables (`order_events`, `catalog_audit_history`, `email_outbox`, `payment_attempts`). *Depends on:* R4 (refunds), R6 (wallet panel). *Risk:* ADMIN-only enforcement, no secret display. *Tests:* permission tests per page, action idempotency. *Acceptance:* every checklist row in PRODUCT_SPEC is IMPLEMENTED or explicitly deferred by the owner.

**R9 · Hardening and compliance.** Edge rate limits (Vercel Firewall), privacy and consent copy, data export/delete path, accessibility and contrast pass at 390 px for account, card and admin, remove dormant French admin strings, add `demo_orders` DDL or retire the demo. *Acceptance:* checklist in TECHNICAL security section closed or accepted by the owner.

**R10 · Acceptance run.** Execute the end-to-end contract on a Vercel preview with an isolated Neon branch, Stripe TEST, sandbox email, a real iPhone, and record evidence. Only then discuss production activation, the loyalty authorization (D13) and the admin UX/UI audit phase.

## Not tested (stated plainly)

Camera scan of any QR, Apple Wallet, real Stripe and Resend, authenticated flows on a Vercel preview, the real-PostgreSQL suites in this audit, mobile layout of admin pages, assistive technology and contrast tooling, Neon concurrency.
