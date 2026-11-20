# Architecture decisions

## 2026-11-17 · PostgreSQL in the demo and deployed design

Accepted for the first slice. Use PGlite with a local data directory for a portable demo and the PostgreSQL driver for Neon connectivity. A local server would add provisioning work and memory-only storage would lose orders. SQL lives in versioned files. Prisma remains planned. See the staff authentication decision below. The demo driver is single-process and requires writable disk.

## 2026-11-17 · Individual staff sessions

Use Better Auth with the shared pg pool and versioned SQL. Keep credential provisioning operator-only and require STAFF or ADMIN for staff sessions and order operations. This retains the existing PostgreSQL deployment path and avoids adding an ORM just for authentication. The independent demo cookie remains available for the private credential-free workflow. Current roles are read with every staff authorization check so demotion takes effect for existing sessions. Both roles handle orders. Reserve store settings and other upcoming management operations for ADMIN.

## 2026-11-18 · Salut Rewards 5 % reuses the existing ledger; guest cards instead of receipt claims

Option B (10 points per $1, 1,000 points = $5) is the preview program; option A (9 + 1) is proposal only. The existing PostgreSQL ledger and QR engine are extended, not replaced. Rounding is `floor` once per order on integer cents. Preview visibility, earning, redemption and commercial authorization are separate flags; `active` stays the master switch and production activation needs the recorded authorization. The $5 reward is a counter-applied discount: online checkout totals are never changed. Guests participate with a random-secret **guest card** (hash at rest, httpOnly cookie, backup code, rate limited, linkable to an account by moving points through the ledger); claiming points from a receipt or tracking link and phone-number identification were rejected as unsafe (a shared link or a guessable value would let someone else claim purchases). Refund reversal is cumulative and proportional, never drives balances negative and records any unrecoverable shortfall. Loyalty details are never shown on private tracking links.

## 2026-11-19 · Stamp card (9 + 1) replaces the points scheme; stamps reuse the ledger

The owner chose option A, "the 10th drink is free", as the program. One stamp is stored as one unit of the existing ledger balance and the free drink is an ordinary reward costing 9, so accounts, guest cards, QR redemption, refund reversal, idempotency, append-only history and concurrency guarantees are unchanged and no second store exists. Earning counts drink quantity (capped at 10 per order or visit), not dollars; `points_per_dollar` is retired but its column kept. Migration 011 clears preview balances through the ledger and refuses to run if the program is commercially authorized and balances exist. Open owner decisions: eligible drinks, free-drink value cap, per-order cap, promotion stacking, expiry.

## 2026-11-20 · Commercial packages and Salut Plus as the development target

Packages are Essential ($1,799 setup, $49/month), **Plus** ($3,199, $79, recommended) and Premium ($4,999, $129), CAD, **proposed and not yet accepted by the client**. Premium includes Plus, Plus includes Essential. Plus adds Stripe payments, customer accounts, history and favorites, Salut Rewards 9+1, digital QR card, **Apple Wallet**, automated notifications and basic analytics. Referrals, birthday promotions, advanced analytics, scheduled campaigns, promo codes and gift cards are Premium and are not built during Plus. Apple Wallet is Plus, not Premium (the former Premium roadmap entry is withdrawn). See [COMMERCIAL.md](COMMERCIAL.md).

## 2026-11-20 · Wallet and printed QR use a separate stable identification token

The 5-minute single-use redemption token must never be embedded in an Apple Wallet pass or a printed card. A separate opaque, stable, revocable identification token, resolvable only by an authenticated staff member, identifies the member; awarding and redeeming remain separate, confirmed, idempotent, audited operations. Whether Wallet alone may authorize a redemption is an open owner/security decision (D6 in [PROJECT_STATUS.md](PROJECT_STATUS.md#decisions-the-owner-must-make); recommendation: the short-lived code is still required). Logo size inside the QR is decided by scan tests with error correction H, not by a fixed ratio.

## 2026-11-20 · Documentation consolidated

Roughly 45 documents were merged into README, COMMERCIAL, PRODUCT_SPEC, PROJECT_STATUS and TECHNICAL, keeping TAX, DECISIONS, CHANGELOG and the image manifest because they carry independent legal, historical or asset responsibilities. The points-era loyalty documents moved to `docs/archive/`. Only PROJECT_STATUS states what is built.

## 2026-11-20 · Rewards rules from the project lead, and a demo mode

Every drink earns a stamp (no category restriction). The free drink is the middle price tier: implemented as a value ceiling of $7.99 on the regular size price (the middle of $5.99/$7.99/$8.99), stored in `loyalty_program.free_drink_max_cents` and editable by an ADMIN; to be confirmed with the owner. A member identified by the stable card QR or Wallet pass may redeem with a STAFF "member present" confirmation (ADMIN switch `identifier_redemption`), superseding the earlier recommendation that the short-lived code always be required.

The site is a **test store until the client approves**: `SALUT_DEMO_MODE=1` turns on a simulated Stripe-style payment page (only while Stripe is not configured), records emails without sending them, creates accounts without verification and auto-enrolls them in Rewards, and enables the demo guide and the admin **Apply demo settings** action. Stripe, Resend and Apple Wallet adapters stay connected to the interface and take over as soon as credentials exist. Demo mode must be off for a real launch.

Apple Wallet passes are built in-repo (ZIP + SHA-1 manifest + PKCS#7 via `node-forge`) instead of with `passkit-generator`, which depends on a vulnerable `joi`.

## 2026-11-20 · Production prepared for the demo

With the project lead's authorization: a backup branch and a rehearsal branch were made in Neon, migration 012 was rehearsed and then applied to `production`, large sizes were set to regular + $1.00 (the production values were inconsistent), the demo settings were applied (hours Mon–Sat 10:30–20:00, 10 min lead time, 10 orders per slot, tax "not registered", all priced products offered, Rewards active, authorization recorded for "project lead (test site)"), and `SALUT_DEMO_MODE=1` was set for Vercel Production. All of it is test-site configuration and is audited in `catalog_audit_history`; none of it is a client approval.

## 2026-11-20 · Topping rule: one included topping, every extra $1.00

Every drink includes one topping chosen from tapioca or the popping pearls; each additional topping, of any kind, costs $1.00 (not $0.75). Implemented in `selectionCost` (`src/catalog-options.ts`): the most expensive selected tapioca/popping option is free, and the base tapioca stored at $0 counts as a standard topping when it is an extra. No catalog migration was needed, so the rule works with the data already in production and with the code deployed before it.

## 2026-11-20 · One authoritative place per admin setting

Prices and availability: only `/admin/menu`. Online ordering on/off: `pickup_checkout_enabled`, surfaced as "Temporarily stop new orders"; opening hours are separate and only define pickup times. Sold out (stays visible, not orderable) and hidden (off the website) are distinct (`catalog_products.published`). Stamp reversal after a refund happens only through the order refund. Photos are chosen from files shipped in `/public`; upload would need new storage and is out of scope. STAFF keep the live queue, counter sale and card scanner; order history stays ADMIN only (owner decision welcome if staff should search past orders).

## 2026-11-20 · One "Menu", one list, one customization step

Customers saw "Menu" and "Catalog" for the same thing, and `/catalog` rendered every drink twice: a browse grid whose "Add to cart +" only scrolled down to a second grid ("Available for pickup") whose "Customize +" opened the options after the last card. Decision: customer-facing copy says **Menu** only ("catalog" stays a back-office term and the `/catalog` route is kept, so links and SEO do not move); `/catalog` is a single list in which filters and search apply; "Customize" opens a dialog on the spot (product pages and collections link to it with `?customize=<id>`); extras are collapsed under "Add extras"; the header cart icon goes to the cart. The browse-only grid remains only when online ordering is closed.
