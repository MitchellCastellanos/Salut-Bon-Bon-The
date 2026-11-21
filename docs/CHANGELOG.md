# Changelog

## 0.1.0

Initialized Salut Plus with localized storefront, sample menu and SQL migration 001. Added pickup ordering, simulated payment, private tracking, staff order operations and smoke test coverage for core order rules. See testing for executed checks.

## Unreleased

- Simplified the dedicated cart in French and English. The page heading and storefront header provide the cart title and brand, so the cart panel starts with the order contents.

- Staff card scanner: the in-page camera now works in every browser with camera access. It uses the native `BarcodeDetector` when present and falls back to `jsQR` (now a production dependency), adds a Stop button, releases the camera on exit and explains blocked permission. Real-device verification still pending.

- Added source-ready art direction and ordered image generation requirements for the five wired storefront slots, plus reserved promotion and owner-supplied asset paths.
- Added individual Better Auth staff accounts, PostgreSQL migration 002, operator provisioning, and server authorization for STAFF and ADMIN order operations.

- Rebuilt the bilingual storefront to match the approved mockup. Added the mango campaign carousel, illustrated category tiles, five demo favorites, pickup and Récompenses Salut / Salut Rewards previews, curated gallery, cart badge, and rich footer. Saved three prompt batches for the 15 wired media slots.

## Commercial catalog milestone

- Added deterministic official beverage and modifier data, independent catalog migration, isolated import verification and bilingual campaign previews.
- Added ADMIN variant pricing and product availability, server-side guarded pickup pricing, and two commercial image prompt batches.

- Added catalog administration, Montréal pickup policy, capacity and tax calculations, opt-in campaign analytics and test-only provider adapters.

## Salut Rewards 5 % (2026-11-18)

- Added migration 009, the public pages `/fr/recompenses` and `/en/rewards` (hero, three steps, calculator driven by the real configuration, reward states, ways to participate, FAQ, final CTA), the guest card (no account), refund reversal, guest-to-account linking, the five program states in ADMIN, cart and product points hints, header/footer/home integration, localized metadata and sitemap, the commercial proposal and the new tests. See [archived Rewards notes](archive/REWARDS_POINTS_ERA_2026-11-18.md) and [Product spec](PRODUCT_SPEC.md#salut-rewards-91).

## Free-drink stamp card, 9 + 1 (2026-11-19)

- Replaced the points scheme with a stamp card: one stamp per eligible drink, the 10th drink free. Added migration 011 (free-drink reward at 9 stamps, `rabais-5` withdrawn, preview balances cleared through the ledger), stamp earning for completed online orders and in-store visits, the `StampProgress` bar on account, guest card, staff counter and public page, stamp wording across cart, product, home, track and admin screens, image prompts BATCH-07 and new tests. The points calculator and earning-rate field were removed. See [archived Rewards notes](archive/REWARDS_POINTS_ERA_2026-11-18.md) and [Product spec](PRODUCT_SPEC.md#salut-rewards-91).

## Documentation consolidation and Salut Plus audit (2026-11-20)

- Merged the former README-linked and specialized documents into `COMMERCIAL.md`, `PRODUCT_SPEC.md`, `PROJECT_STATUS.md` and `TECHNICAL.md`; archived the points-era loyalty proposal and rewards notes under `docs/archive/`; refreshed `README.md`, `AGENTS.md` and `CLAUDE.md`. Recorded the audited implementation state, the owner decisions pending and the roadmap to finish Salut Plus. No application code or migration changed.

## Salut Plus demo completion (2026-11-20)

- Migration 012; demo mode with a simulated payment page, recorded-not-sent email, auto-enrolment and `/demo` guides; stable revocable card identification with a level-H logo QR and `/s/<code>` scanner entry; in-page camera scanner and redemption by identified member; Apple Wallet pass builder, update web service and admin panel (inactive without Apple credentials); free-drink ceiling ($7.99, editable); favorites and reorder; admin order history, cancel and refund, notification log, change history, wallet status, dashboard stages and attention list; header and product links now lead to the real ordering; card orders are accepted by the official catalog (previously refused); `frame-ancestors 'self'`. New tests: `tests/plus-completion.test.ts`, `tests/plus-demo-smoke.mjs`; existing rewards suites adapted to the new card.

## Topping rule (2026-11-20)

- One included topping (tapioca or a popping pearl, customer's choice) and $1.00 per extra topping on the official menu and customization screen (grouped choices, tapioca first); the isolated demo menu moved from $0.75 to $1.00. New `tests/toppings.test.ts`; the free-drink value is shown on the card, rewards page, product pages, scanner and Wallet pass.

## 2026-11-20 · Administration audit and restructure

Navigation regrouped (Orders, Menu, Customers and loyalty, Store, Reports, Settings). Drinks, prices and toppings merged into one Menu area (the old catalog, price sheet and "quick pricing" are gone); product and category creation, topping checkboxes instead of typed identifiers, sold-out versus hidden (migration 013). One "Temporarily stop new orders" switch on the dashboard and hours page. New Reports (sales net of refunds, daily sales, top drinks, loyalty), Payments and integrations status page, Website content page, plain-language change history with filter by item. Duplicate stamp-reversal form removed from Rewards (refunds reverse stamps from the order page). Cancellation now reports a stale state instead of a false success. Confirmations on risky actions, English-only labels, mobile-friendly lists. Tests: `tests/admin-ops.test.ts`, `tests/admin-permissions.test.ts`, `tests/admin-audit-smoke.mjs`.
