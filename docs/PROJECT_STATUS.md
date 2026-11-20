# Project status

**Updated 2026-11-20**: audit and consolidation on `main` @ `fd93a18` plus the scope documents, followed by the Salut Plus implementation pass. This is the only document that says what is built. Statuses are **IMPLEMENTED / PARTIAL / ABSENT / BLOCKED** and rest on code, migrations and tests inspected in this audit, never on earlier prose. Requirements: [PRODUCT_SPEC.md](PRODUCT_SPEC.md). Packages: [COMMERCIAL.md](COMMERCIAL.md). Technical detail: [TECHNICAL.md](TECHNICAL.md).

## Verified

Audit of 2026-11-20 (documentation consolidation) and the implementation pass of the same day on branch `claude/affectionate-gauss-gaavni`.

| Check | Result |
| --- | --- |
| `npm run check` (route types, `tsc --noEmit`, ESLint) | Passed |
| `npm test` with a real PostgreSQL 16 (`TEST_DATABASE_URL`) | **All passed** (140 tests incl. concurrency, capacity, counter and the new `tests/plus-completion.test.ts`); without PostgreSQL 13 skip |
| `npm run build` | Passed |
| `npm audit --omit=dev` | 0 vulnerabilities |
| Browser: `tests/plus-demo-smoke.mjs` (new, whole Plus journey, demo mode) | Passed |
| Browser: `test:rewards`, `test:rewards-public` (existing, adapted to the new card) | Passed |
| Not run | Camera scan on a phone, Apple Wallet on a real iPhone, real Stripe and Resend, Vercel preview, storefront/staff/catalog suites, accessibility tooling |
| Neon `production`, 2026-11-20 after the release | Migration 012 applied (12 in the ledger, rehearsed first on branch `rehearsal-012`, backup branch `pre-release-20261120`); 62 products offered; Rewards active with the free drink at $7.99; checkout enabled with tax status "not registered"; 0 orders, 1 ADMIN |

## Summary

Salut Plus is **functionally complete in demo mode** and awaiting the three things only the owner can provide. A visitor can create an account, order a customized drink from the real catalog, pay on a simulated Stripe-style page, follow the order live, and the team receives it on `/staff`, confirms, prepares, marks it ready and completes it. The customer earns stamps (every drink counts), shows a QR card with the official logo, scans at the counter, collects in-store stamps and redeems the free drink. The admin has order history with cancellation and refunds, a notification log, a change history, readiness and a wallet panel. `/demo` and `/demo/side-by-side` explain and show the whole journey.

Stripe and Resend adapters stay connected: with Stripe keys the simulated page is replaced by Stripe Checkout; with Resend credentials emails are sent. Until then payments are simulated and emails are only recorded. Apple Wallet is **built and tested with generated test certificates** (signed ZIP, manifest, update web service, push), but needs the owner's Apple Developer credentials to become available, and has never been installed on a real iPhone.

Production (Neon `production`) is **ready for the demo**: migration 012 is applied, the demo settings and prices were applied directly in the database (audited as `demo.*`), and `SALUT_DEMO_MODE=1` is set for the Vercel Production target. The application code takes effect when this branch is merged to `main` and deployed. Until then the deployed code is the old one running on the new schema (additive, compatible). `SALUT_INSTANT_ACCOUNTS` becomes unnecessary (demo mode implies it). The shared ADMIN password from 2026-11-19 must still be changed.

## Salut Plus feature matrix

| # | Capability | Status | Evidence | Remaining |
| --- | --- | --- | --- | --- |
| 1 | Create account, verify email, sign in/out, reset | **IMPLEMENTED; email delivery BLOCKED** | `src/auth.ts`, `app/[lang]/account/*`; demo mode skips verification and auto-enrolls in Rewards at sign-in | Real verification email needs a Resend domain and key; then turn demo mode off |
| 2 | Catalog with photos and real prices | **PARTIAL** | 62 products, 26 photos, 124 priced variants in production | Owner must confirm large-size and matcha prices; production large prices are lower than regular for two categories (see risks) |
| 3 | Drink customization | **IMPLEMENTED** | Size, sugar, ice; one included topping (tapioca or a popping pearl, chosen by the customer) and every extra at $1.00 (`src/catalog-options.ts`, `menu.tsx`, `tests/toppings.test.ts`); verified in a browser: $5.99 with tapioca or a popping pearl, $7.99 with an included topping plus a jelly plus an extra pearl | Per-drink topping eligibility is not modeled: every drink offers every topping (D8) |
| 4 | Cart and pickup checkout | **IMPLEMENTED** | `src/orders.ts`, tested incl. concurrency | Owner sets real lead time and capacity (demo settings use 10 min / 10 per slot) |
| 5 | Online payment | **IMPLEMENTED in simulation; Stripe adapter BLOCKED on keys** | `/[lang]/pay/[session]`, `src/card-checkout.ts`, `applySimulatedPayment` (same reconciliation as signed webhooks), `tests/plus-completion.test.ts`. Fixed: card orders were rejected by the official catalog (`placeOrder`), so the Stripe path was unreachable before | Real Stripe test session never exercised; success redirect now returns to the order |
| 6 | Order status and history for the customer | **IMPLEMENTED** | Tracking page with live timeline, *My orders* with **Order again** | – |
| 7 | Favorites and reorder | **IMPLEMENTED** | `src/favorites.ts`, heart on product pages, *My favorites*, `ReorderButton`, `tests/plus-completion.test.ts` | – |
| 8 | Staff process the order | **IMPLEMENTED** | `/staff` (NEW badge, guidance in demo), transitions, ready/cancelled notices, tested in `plus-demo-smoke.mjs` | – |
| 9 | Stamps for completed orders | **IMPLEMENTED, active by ADMIN** | `earnForOrder`; every drink earns (D1 decided); demo settings activate and authorize the program | Cap per order, stacking, expiry still open |
| 10 | Digital loyalty card | **IMPLEMENTED** | `src/member-card.tsx`, progress bar, QR, Wallet action, replace-QR, optional single-use code | Stamp artwork (BATCH-07) still missing: SVG fallback |
| 11 | QR with official logo | **IMPLEMENTED; phone test pending** | `src/qr-logo.ts`: level H, 4-module quiet zone, light plate, natural aspect ratio; `npm run qr:calibrate` decodes up to 34 % logo height (16 % plate area), configured at 28 % | Confirm on real iPhone/Android cameras and a scanner |
| 12 | Stable, opaque, revocable identification | **IMPLEMENTED** | `src/identification.ts`, `/s/[code]`, migration 012, rotation/revocation, audit, tests | – |
| 13 | Apple Wallet pass | **IMPLEMENTED, BLOCKED on Apple credentials** | `src/wallet.ts` (ZIP, SHA-1 manifest, PKCS#7 signature verified with OpenSSL against generated test certificates), `/api/wallet/pass` and the `/v1` update web service, APNs push, `/admin/wallet` | Needs Pass Type ID + WWDR certificates; never installed on a real iPhone; SHA-1 signing mirrors common practice but is unverified against Apple |
| 14 | Staff scan, award, redeem | **IMPLEMENTED** | `/staff/rewards`: link/ID/camera/scanner input, in-store stamps, redeem with "member present" confirmation, rate limits, ledger actor; denied to anonymous (tested) | Camera scanning needs `BarcodeDetector` (Chrome/Android); iPhone uses the camera app |
| 15 | Free drink value | **IMPLEMENTED** | `loyalty_program.free_drink_max_cents` = $7.99, editable in `/admin/rewards` and reflected everywhere it matters: public rewards page and FAQ, member card, account rewards list, product pages ("can be your free drink"), staff scanner and the Wallet pass | Interpretation of "middle price" to confirm (D2) |
| 16 | Refunds | **IMPLEMENTED (simulation); Stripe API untested** | `src/refunds.ts`, `/admin/orders/[number]`, idempotent, audited, stamps reversed | Real Stripe refund never exercised |
| 17 | Automated notifications | **IMPLEMENTED in log mode; sending BLOCKED on Resend** | Outbox, 4 FR/EN templates, `/admin/notifications` (log and preview) | Real delivery needs credentials; templates are code, not editable in admin |
| 18 | Basic analytics | **PARTIAL** | Sales cards, order counts, opt-in event analytics | Product and loyalty participation reports |
| 19 | Package entitlements | **ABSENT** | – | Product decision D15 |
| 20 | Live-activation gates | **IMPLEMENTED** | Stripe/Resend modes, demo mode explicit, loyalty authorization recorded by the ADMIN | – |

## Admin coverage

Admin checklist numbers refer to [PRODUCT_SPEC.md](PRODUCT_SPEC.md#admin-requirements-for-salut-plus). Server-side roles are enforced on every admin page and action (`/admin/*` is ADMIN only, `/staff*` is STAFF or ADMIN). Admin writes are recorded in `catalog_audit_history` and are now readable at `/admin/activity`.

| # | Area | Status | What exists | What is missing |
| --- | --- | --- | --- | --- |
| 1 | Overview | **IMPLEMENTED** | `/admin`: readiness blockers, sales, orders by stage, "needs attention" (stale new orders, refunds due, failed emails), system status, demo settings | Last-updated indication |
| 2 | Orders | **IMPLEMENTED** | `/admin/orders` search by number/name/email, status, payment and date range; detail with items, payments, events, emails, stamps; cancel with reason; refund (partial or full, idempotent, audited) | Stripe refunds untested against real Stripe |
| 3 | Catalog | **PARTIAL** | `/admin/catalog`, `/admin/prices`, `/admin/campaigns`: edit categories, collections, modifiers, products, eligibility, prices, offered flag | Cannot create products or categories; no stock-out shortcut, preview before publish or image upload |
| 4 | Store and pickup | **IMPLEMENTED** | `/admin/hours`, `/admin/business`, demo settings | Customer-visible notice banner |
| 5 | Payments and taxes | **PARTIAL** | Fiscal settings, receipts, refunds, payment status in order detail, provider status on the dashboard | No payment reconciliation list |
| 6 | Customers | **IMPLEMENTED** | List, detail, orders, ledger, card QR replace/revoke | Privacy export/delete |
| 7 | Rewards rules | **IMPLEMENTED** | `/admin/rewards`: states, rules, free-drink ceiling, identifier-redemption switch, adjustments, suspension, refund reversal | Expiry and stacking are not modeled |
| 8 | Wallet and QR | **IMPLEMENTED** | `/admin/wallet`: readiness (names only), counts, recent passes, errors; QR rotation/revocation on the customer page | Pass design preview |
| 9 | Notifications | **PARTIAL** | `/admin/notifications`: log, status filter, FR/EN preview, provider status | Editing templates, resend button |
| 10 | Analytics | **PARTIAL** | Sales, orders by stage, event analytics | Product and loyalty reports |
| 11 | Staff and access | **IMPLEMENTED** | `/admin/team`, `/admin/activity` change history | Sign-in diagnostics |
| 12 | Content and settings | **PARTIAL** | Campaigns, business profile, hours | Editors for homepage copy, SEO and legal pages |

ADMIN versus STAFF is clean in code: STAFF reach the live queue, counter sales and the card scanner; everything under `/admin` is ADMIN only; secrets, certificates, migrations and provider keys are environment-only and never displayed (only "present/missing").

## Preliminary admin UX/UI findings (no redesign yet)

Findings only; the full audit is a separate later phase.

1. **Orders are split between `/staff` (live queue) and `/admin/orders` (history).** Both are linked from the sidebar, but the owner may expect one place.
2. **Product setup is split across four pages** (`/admin/catalog`, `/admin/prices`, `/admin/campaigns` "quick pricing", `/admin/rewards` categories): the same product is edited in three places. Group under one Menu section.
3. **`/admin/catalog` is a long page of one-line forms** with free-text id lists ("Eligible (comma-separated IDs)", "Defaults (IDs)") and image paths; error-prone for a non-developer.
4. **Dashboard now shows stages and an attention list**, but is long; prioritize in the later audit.
5. **Dormant French strings** (`fr ? … : …`) remain in admin pages and navigation labels despite the English-only rule; they are never displayed but violate the convention for new screens.
6. **Counter sale and card scan appear twice** (sidebar and dashboard cards) with different wording.
7. **No in-product help or defaults.** Settings such as lead time and capacity are blank by design but give no guidance.
8. **Mobile/tablet and accessibility of admin pages untested** (the hours editor and price sheet are dense).
9. **Mixed identifiers.** Raw ids (`milk-tea`, group ids) are shown as labels.
10. **Catalog and price screens still do not link to the change history** (the history exists at `/admin/activity`).

## Risks and corrected documentation conflicts

1. **Demo mode must be off for a real launch.** `SALUT_DEMO_MODE=1` enables simulated payments (anyone with the link can "pay"), no-email accounts and auto-enrollment. Turn it off and connect Stripe/Resend before any real customer.
2. **`SALUT_INSTANT_ACCOUNTS=1` is enabled in production** (2026-11-19); anyone can register an address they do not own. Demo mode supersedes it; remove both for launch.
3. **An ADMIN password was shared in chat** (2026-11-19). Change it.
4. **Prices are demo values, not owner-confirmed.** On 2026-11-20 production large sizes were set to regular + $1.00 for every product (they were inconsistent: large was cheaper than regular for crème brûlée and smoothies). Regular prices are the owner's (matcha $6.75 is not confirmed). Confirm in `/admin/prices` (D8).
5. **Every modifier is assigned to every product** (unconfirmed by the owner). The topping rule itself (one included, extras $1.00) is implemented; the base tapioca is stored at $0 in the catalog and the pricing code treats it as a standard topping when it is an extra.
6. **Free-drink rule interpretation.** "The free drink is the middle price" was implemented as a value ceiling of $7.99 (the middle of $5.99/$7.99/$8.99), editable in the admin. Confirm that it is not "only drinks priced exactly $7.99".
7. **Wallet is untested on a device.** The pass signature validates with OpenSSL against test certificates only.
8. **`demo_orders` has no DDL in the repository** and `/api/demo-orders` depends on it; the legacy isolated demo cannot be rebuilt from the repo (the header now leads to the real flow).
9. **Edge rate limits** (Vercel Firewall) for checkout and staff sign-in are not configured. Pages may now only be framed by this site (`frame-ancestors 'self'`).
10. **Found and fixed during the build:** card orders were refused by `placeOrder` in the official catalog (Stripe could never be reached); the header "Order" button and product "Add to cart" links led to the isolated demo, not the real ordering; the previous QR used error correction M and a 1-module quiet zone.
11. **Documents had contradicted code** before the consolidation; history is in [archive/](archive/).

## Decisions the owner must make

Decided on 2026-11-20 by the project lead: **D1** every drink earns a stamp (no category restriction); **D2** the free drink is the middle price tier (implemented as a $7.99 ceiling); **D6** a card identified by its stable QR or Wallet pass may be redeemed by STAFF with a "member present" confirmation (ADMIN can switch this off to require the single-use code). Redemption is allowed in this test site until the client approves.

| # | Decision | Needed for |
| --- | --- | --- |
| D2 | Confirm the free-drink interpretation and the value ($7.99, regular size, extras at normal price) | Redemption |
| D3 | Maximum stamps per order or visit (10 is a placeholder) | Earning |
| D4 | Stacking with promotions and discounts | Earning/redemption |
| D5 | Stamp expiry (none today) and a refund after redemption | Policy |
| D7 | Whether online redemption will ever exist (spec: counter only) | Scope |
| D8 | Large-size price differential, matcha price, which toppings apply to which drinks | Pricing and checkout |
| D9 | Real lead time, per-slot capacity and confirmed opening hours (demo uses Mon–Sat 10:30–20:00, 10 min, 10 orders) | Opening checkout |
| D10 | GST/QST legal name and numbers (the demo uses "not registered", so no tax), accountant's answer on a certified sales recording system | Tax and receipts |
| D11 | Confirm business address and phone (unverified) | Profile and structured data |
| D12 | Signed commercial proposal: prices, maintenance, Apple Developer ownership, recurring costs and fees | Contract |
| D13 | Final loyalty authorization by the client and launch date (the demo records the administrator's authorization) | Production activation |
| D14 | Privacy and consent copy for accounts, loyalty and analytics; retention | Launch |
| D15 | Whether package entitlements must be enforced in code | Premium later |

## External dependencies and blockers

| Dependency | Needed for | State |
| --- | --- | --- |
| Merge of PR #25 to `main` (deploys to production) | Showing the demo on the deployed site | Waiting for the owner of the repository |
| Migration 012 on Neon `development` | Preview deployments | Not applied (previews would run without demo mode) |
| Stripe test secret key and webhook secret | Real Stripe Checkout instead of the simulated page | BLOCKED (optional for the demo) |
| Resend verified sending domain, API key, `STORE_NOTIFICATION_EMAIL`, `CRON_SECRET` | Real email | BLOCKED (optional for the demo) |
| Apple Developer Program account, Pass Type ID certificate and key, WWDR certificate, team id (`APPLE_*` variables, see TECHNICAL) | "Add to Apple Wallet" | BLOCKED |
| Real iPhone and Android devices | QR scan and Wallet verification | Needed |
| Stamp artwork (BATCH-07), rewards/account images (BATCH-06), `public/brand/logo-email.png` | Polish | Missing (fallbacks shown) |

## Roadmap to finish

Everything on the original Plus list is built. What remains, in order:

1. **Owner inputs (no code):** change the shared ADMIN password; confirm D2, D8, D9 and D10; supply Apple credentials, Stripe test keys and a Resend domain when available.
2. **Deploy the demo:** merge PR #25 (production deploys from `main`) and walk through [PRODUCT_SPEC.md](PRODUCT_SPEC.md#demo-script-plus-test-environment). Database and environment are already prepared.
3. **Real-device verification:** scan the card QR with iPhone/Android cameras and a scanner at several sizes and distances (confirm or lower `qrLogoHeightRatio`); when Apple credentials exist, install the pass on an iPhone, scan it, and confirm a stamp update refreshes it.
4. **Provider switch-on in TEST:** add Stripe test keys (the simulated page is replaced automatically) and run a real test payment and refund; add Resend and confirm sandbox delivery, then turn demo mode and instant accounts off.
5. **Remaining admin gaps:** product/category creation, template editing and resend, analytics for products and loyalty, content editors.
6. **Hardening:** edge rate limits, privacy copy and data export/delete, accessibility pass, remove dormant French admin strings, add or retire the `demo_orders` demo.
7. **Then:** the separate admin UX/UI audit phase and the production activation decisions (D13).

## Not tested (stated plainly)

Camera scan of the QR on a phone, Apple Wallet on a real iPhone, real Stripe and Resend, authenticated flows on a Vercel preview, mobile layout of the admin pages, assistive technology and contrast tooling, Neon concurrency.
