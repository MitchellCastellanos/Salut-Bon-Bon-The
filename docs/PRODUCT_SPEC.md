# Product specification

What Salut Plus must do and how it is accepted. This file never states whether something is built: implementation state lives only in [PROJECT_STATUS.md](PROJECT_STATUS.md). Packages and prices: [COMMERCIAL.md](COMMERCIAL.md). Architecture, configuration and security: [TECHNICAL.md](TECHNICAL.md).

## Roles

| Role | Journey | Acceptance |
| --- | --- | --- |
| Guest | FR/EN menu, customize, reserve pickup, pay at pickup | Server prices every line, one order per submission, private tracking link |
| Customer (account) | Register, verify email, order, pay online, history, favorites, reorder, loyalty card/QR/Wallet | Only the holder sees history and stamps; reorder revalidates the current menu |
| STAFF | Live orders, preparation, pickup payment, counter sales, card scan, award and redeem | Server-enforced role on every action; sensitive loyalty actions are confirmed, idempotent and audited |
| ADMIN | Everything STAFF does plus configuration, catalog, prices, hours, tax, rewards rules, customers, team | Server-enforced, audited changes; secrets and certificates never editable in the UI |
| Owner | Bilingual public site, local discovery, store information | Responsive, verified content, official links |

Defaults: French (Canada) first, English selectable, CAD, time zone `America/Toronto`. **Language policy (owner decision 2026-11-19):** the public site has full FR/EN parity; the admin and staff console (`/admin/*`, `/staff/*`) is **English only** and `/fr/admin*`, `/fr/staff*` redirect to `/en/...`. Customer-facing output generated from the console (emails, receipts, tracking, public pages) stays bilingual. Full loyalty program name: **Récompenses Salut** (FR), **Salut Rewards** (EN).

## Salut Plus end-to-end acceptance contract

Goal: demonstrate one genuine integrated journey in FR and EN, never claiming real payments or production readiness from test mode:

register → verify email → browse the official priced catalog → customize a drink (size, toppings) → cart → pickup order → Stripe **TEST** payment → customer sees status/history → staff process the order → completed → stamps awarded → customer opens the digital card → QR with the centered official logo → Add to Apple Wallet → staff scan identifies the customer → staff award/redeem with audit.

Definition of done:

1. **Accounts.** Create account, verify email, sign in/out, recover password; customer and staff identities isolated. Tested with the Resend sandbox and disposable identities.
2. **Catalog and pricing.** Official catalog with real configured prices, included tapioca, +$1 per additional approved topping (unless the owner changes it), size upgrade, taxes and modifiers computed on the server and checked against the official price sheet.
3. **Checkout and payment.** Idempotent order creation, Stripe-hosted test checkout (no home-made card form), webhook reconciliation; accurate customer history/status; staff lifecycle; retries and failures never duplicate orders or stamps.
4. **Rewards 9+1** (below), not the historical points scheme. Award on verified completion only, once per order; cancellations/refunds, eligible categories and thresholds tested. Redemption at the counter unless the owner separately approves online redemption. Loyalty stays inactive in production until the owner authorizes it.
5. **Branded QR** on the customer card (and guest card): official logo centered **as large as practical while remaining reliably scannable** (see [QR and Wallet](#qr-and-wallet-identification)).
6. **Apple Wallet.** A genuine signed `.pkpass`, "Add to Apple Wallet" action, brand, customer identity and stamp progress, installed and scanned on a real iPhone. No screenshots standing in for Wallet. Documented issue/update/revoke lifecycle; credentials server-side and out of git.
7. **Security architecture.** Separate, stable, opaque, revocable identification token for Wallet/printed QR versus the short-lived single-use redemption code (below).
8. **Staff scanner.** Works with a phone camera, an external scanner or manual entry; requires a staff role; anonymous and customer attempts denied; repeated scans never award twice.
9. **Quality.** Bilingual, accessible, mobile-first, with empty/loading/error states and privacy consent. No real customer data in demos.
10. **Verification.** Lint/types, unit and integration tests, real-PostgreSQL concurrency, browser E2E and production build, then a Vercel preview with an isolated Neon branch, Stripe test and sandbox email, with evidence and remaining prerequisites recorded.

### Demo script (Plus, test environment)

1. Admin confirms hours, capacity, tax status, prices and "Offered", and switches pickup ordering on (`/admin/hours`, `/admin/business`, `/admin/prices`).
2. Customer registers and verifies, browses the photo catalog, customizes (size, toppings), adds to the cart, picks a slot and pays with a Stripe test card.
3. Customer follows the order under *My orders* and the private tracking page.
4. Staff sign in at `/en/staff`, move the order through confirmed → preparing → ready → completed.
5. Customer sees the new stamp on the card, shows the QR, adds the pass to Apple Wallet.
6. Staff scan the QR or Wallet barcode at `/staff/rewards`, award in-store stamps, and redeem the free drink after nine stamps.
7. Admin reviews the customer, the ledger and the sales dashboard.

Use synthetic names only. The credential-free local demo (no database) uses the staff password `salut-demo` and `.salut-data`, must stay private, and is never a production path.

## Catalog and pricing

- Official catalog: 62 products, 52 printed codes, 124 FR/EN translations, 18 modifiers, 7 categories, 4 campaigns, source [`catalog/official.json`](../catalog/official.json). Sources: milk tea 20, fruit tea 13, matcha 3, smoothies 10, coded lemonade 6, mango specialties 5, crème brûlée specialties 4, uncoded pineapple lemonade 1. The poster collection links 701, 702, 704, 706, pineapple-lemonade and 707 and reuses 701 for the poster's White Peach wording; blueberry 705 stays in the regular catalog; no source exists for 703. Original French wording, printed identifiers and the green grape "Nouveau" annotation are preserved.
- Owner-supplied regular prices (2026-11-18 photos, CAD before tax): milk bubble tea $5.99, fruit tea $5.99, smoothies $7.99, Fresh Mango Series $7.99, Crème Brûlée $8.99, house lemonade $5.99.
- Owner rule: one tapioca serving included; each additional topping $1.00. Options photographed: popping pearls (tapioca, cherry, strawberry, passion fruit, lychee, dragon fruit, mango, green apple, peach, brown sugar boba, coconut, kiwi) and jellies (rainbow, mango, lychee, aloe vera, coconut, green apple).
- **Not confirmed by the owner (never invent):** matcha price, large-size price differential, and whether every drink supports every topping. A second tapioca must be chargeable (an extra, not the included one).
- Server pricing is authoritative: checkout reprices from approved, available variants, requires reconfirmation if a price changed, and refuses unapproved products. Matching UI labels: **Customize** / **Personnaliser**.
- QA before accepting pricing: displayed prices, sizes, default free tapioca, multiple extras at +$1 each, client total vs server quote, cart, checkout, receipt, rewards, FR/EN, mobile.

## Pickup, hours and store profile

All rules use `America/Toronto` and run on the server; changes in the admin apply immediately without redeploy. **Nothing is predefined:** no lead time or capacity exists until the business decides.

- **Weekly hours:** per weekday open/closed and up to four non-overlapping intervals.
- **Pickup settings:** lead time 5–1440 min, slot length 5/10/15/20/30/60 min, orders per slot, advance window 1–60 days, optional same-day cutoff, and the *pickup ordering enabled* switch (this is also the pause/resume control).
- **Exceptions:** date ranges either closed or with special hours, with an optional reason; later entries override earlier ones and the weekly schedule.
- **Slot acceptance:** on a slot boundary, within lead time and advance window, before the cutoff, wholly inside an open interval, and below capacity (per-slot PostgreSQL advisory lock, so concurrent orders cannot oversell). Forged times are refused.
- **Checkout readiness gate:** opens only when the switch is on, a schedule exists, lead time and capacity are set, a fiscal status is chosen, the business profile exists, and at least one product has an approved price. The admin lists exactly what is missing.
- **Business profile** (name, address, postal code, phone, verification status) is a single record that feeds the footer, "Come see us", checkout pickup instructions, tracking, receipts, emails and structured data; JSON-LD is published only after the owner confirms the profile. No email address or social link is ever invented.
- **Taxes:** GST 5 % and QST 9.975 %, each on the pre-tax subtotal, collected only when the status is *registered* with both numbers. Legal findings and what is not covered: [TAX.md](TAX.md).

## Salut Rewards 9+1

Decision (owner, 2026-11-19): **9 eligible drinks purchased, the 10th is free.** The points scheme (10 points/$1, 1,000 points = $5) is superseded history ([archive](archive/REWARDS_POINTS_ERA_2026-11-18.md)).

Rules as specified:

- One stamp per eligible drink; quantity counts, dollars do not. The free drink costs 9 stamps; extra stamps carry over. The free drink itself earns nothing.
- **Online earning:** when STAFF mark a paid order COMPLETED, the account linked to the order (member or guest card) receives `min(drinks, per-order cap)` stamps, once per order. Cancelled or unfinished orders earn nothing; the program must be active with earning enabled; nothing is back-filled for orders completed while it was off.
- **In-store earning:** after an identification scan, STAFF enter the number of eligible drinks (1 to the per-order cap), idempotent per form.
- **Refunds:** stamps are taken back proportionally to the refunded pre-tax amount; a full refund takes all; the balance never goes negative and any shortfall is recorded.
- **Redemption** happens at the counter. Online checkout totals are never changed.
- **ADMIN controls:** active, public-preview visibility, earning enabled, redemption enabled, recorded owner authorization (required to activate in production), minimum purchase, eligible categories, reward availability and eligibility, manual adjustments with a mandatory reason, account suspension, refund reversal, customer lookup with history.
- **Guests** may hold a card without an account (random 256-bit secret, hashed at rest, httpOnly cookie plus a backup code); cards can be linked to an account later. Claiming purchases from a receipt/tracking link and phone-number identification were rejected as unsafe.
- Loyalty details never appear on private tracking links. Public pages show only program terms.

**Owner decisions still open** (not decided in code): which categories are eligible, maximum value of the free drink, per-order cap (10 is a placeholder), combination with promotions, expiry, treatment of a refund after redemption, whether redemption may ever be online, the launch date and the recorded authorization. Tracked in [PROJECT_STATUS.md](PROJECT_STATUS.md#decisions-the-owner-must-make).

## QR and Wallet identification

Two different credentials with different purposes. **Never reuse one for the other.**

| | Redemption code (exists) | Identification token (to build) |
| --- | --- | --- |
| Purpose | Authorize a one-off redemption | Identify the member in store (card QR, Wallet barcode, printed card) |
| Lifetime | 5 minutes, single use, replaced by the next one | Stable until revoked |
| Content | Random 32 bytes (hash stored) inside a staff URL | Opaque, no personal data, not guessable, not a member code, not a session |
| Who can use it | Staff session, then explicit confirmation | Staff session only: lookup shows first name, code, balance |
| Revocation | Expires or is consumed | ADMIN/customer rotation; old value stops resolving immediately |

Requirements for the identification token and Wallet pass:

1. Opaque and short (shorter payload means fewer QR modules, so a bigger logo is possible). Recommended design: a stable public `serial` plus a revocable per-account `version`, with the barcode value derived server-side (e.g. HMAC of serial and version with a server key) so rotation is a version bump and no raw secret needs storing. Final design is an implementation decision, subject to the rules here.
2. Lookup is rate limited and staff-authenticated; anonymous or customer requests learn nothing (uniform not-found).
3. Identification alone may show the card and allow **awarding** stamps. **Redeeming** a free drink must still be authorized by a fresh confirmation by STAFF and, unless the owner decides otherwise, by the short-lived single-use code from the customer's account page (a leaked or photographed stable QR must not be enough to redeem). Owner/security decision recorded in PROJECT_STATUS.
4. Every award/redeem is idempotent, attributable to a staff member, and written to the append-only ledger.
5. Revoking an identification also marks the Wallet pass invalid and stops pass updates; reissue creates a new pass for the same account.

**Logo QR requirements.** Error correction level **H**, quiet zone of at least four modules (not the current 1), high contrast dark-on-light, a light backing plate under the logo, the official logo at its natural aspect ratio (the supplied SVG is tall, 1065 × 1477) never stretched, responsive sizes, and SVG output. The logo size is **validated by scan tests, not set by a fixed ratio**: increase it until scans become unreliable, then back off with a margin. Test matrix: real iPhone and Android camera apps, a USB/Bluetooth scanner, several distances, screen brightness levels and sizes, light and dark mode. Record the decoded result and success rate. Do not promise a fixed maximum percentage.

**Apple Wallet requirements.** Genuine signed `.pkpass`: Apple Developer Program account, Pass Type ID certificate and Apple WWDR certificate, team identifier, brand icons/logo assets, barcode (identification token, QR format), stamp progress, and a web service for updates if updates are wanted (`webServiceURL`, `authenticationToken`, registration endpoints, push). Certificates and keys live only in server-side secret storage, never in git. Lifecycle: issue, download, update on stamp change, revoke/void, reissue, certificate renewal. Admin needs status, last update, failures and reissue/revoke, never the credentials. Done only when verified on a real iPhone.

## Admin requirements for Salut Plus

Principle: Plus is not end-to-end until the owner can operate every promised function without a developer. Each configurable rule needs a secure ADMIN control, validation, persistence, feedback, audit trail and a documented default; no screen may bypass production gates or owner authorization. Secrets, certificates and dangerous operations stay protected. ADMIN configures and handles sensitive actions; STAFF fulfil orders and perform authorized loyalty operations.

Permissions:

| Area | STAFF | ADMIN |
| --- | :-: | :-: |
| Order queue, state changes, pickup payment, cancel | Yes | Yes |
| Counter sales | Yes | Yes |
| Card scan, in-store award, redeem | Yes | Yes |
| Catalog, prices, hours, business/tax, campaigns | – | Yes |
| Rewards rules, adjustments, suspension, refund reversal | – | Yes |
| Customers list and detail | – | Yes |
| Team and access | – | Yes |
| Analytics | – | Yes |

Checklist (numbered; statuses are in [PROJECT_STATUS.md](PROJECT_STATUS.md#admin-coverage)):

1. **Overview:** actionable dashboard (new, paid, preparing, ready, completed, cancelled orders; issues needing attention; quick links; empty/error states; last-updated indication).
2. **Orders:** searchable queue and history; detail with modifiers, taxes, payment status, customer/guest context, pickup slot, transitions, cancellation and **refund** workflow with safeguards, duplicate prevention, event history, staff attribution.
3. **Catalog:** create/edit products, categories, images, FR/EN text, availability, visibility, featured, prices, sizes, topping rules (included tapioca, paid extras), compatibility, stock-outs, preview before publish.
4. **Store and pickup:** contact, location, hours, closures, slot rules, lead time, capacity, pause/resume, notices.
5. **Payments and taxes:** Stripe test/live readiness (no raw secrets), payment/reconciliation/refund status, tax configuration, receipts, safe activation with audit; no real charges in the demo.
6. **Customers:** search by permitted identifiers, account/order/loyalty context, account status, minimal personal data, privacy controls, no impersonation by staff.
7. **Rewards 9+1:** activation and authorization, eligibility, minimum, cap, free-drink ceiling, stacking, expiry/refund policy, guest/member linking, lookup, balance/history, adjustments with reason, suspension, scan/award/redeem; idempotency and audit.
8. **Wallet and QR:** issuance/signing readiness, template and brand assets, pass status and last update, reissue/revoke/rotate, failed updates, support diagnostics, never credentials.
9. **Notifications:** templates with FR/EN preview, provider status, consent where applicable, delivery log, retries/failures, test/live gates, safe resend.
10. **Analytics (basic):** orders, sales, products, loyalty participation and redemption, filters, date ranges, definitions, privacy. Advanced marketing analytics are Premium.
11. **Staff and access:** account/role lifecycle, least privilege, admin-only settings, session handling, confirmation of critical actions, audit log viewer, diagnostics.
12. **Content and settings:** brand/logo, bilingual storefront content, homepage campaign visibility, SEO essentials, public rewards copy, legal/contact links, publication status.

### Later phase: admin UX/UI audit (not part of the Plus build)

After Plus functionality is complete, run a separate, comprehensive audit of the admin: information architecture and navigation, grouping, dashboard priorities, workflow click counts, discoverability, search/filter, bulk actions, forms and validation, feedback and errors, wording, mobile/tablet, accessibility and keyboard, permission visibility, performance, consistency, empty/loading states, destructive-action safeguards, onboarding/help. Deliver task-based usability scenarios for owner and staff, annotated evidence, severity ranking, low-effort wins, wireframes and phased implementation. Preliminary findings are in [PROJECT_STATUS.md](PROJECT_STATUS.md#preliminary-admin-uxui-findings-no-redesign-yet). **No general redesign before that audit.**

## Notifications

Transactional only: customer confirmation, store notification, ready for pickup, cancelled, plus account verification and password reset. FR and EN, branded, HTML-escaped. Customer email is optional and used only for the order; no marketing consent is collected or implied, and marketing email would be a separate opt-in system (Premium). Pay-at-pickup orders notify on placement; card orders notify once payment settles. SMS (Twilio) is optional, out of the launch scope and needs consent, a number, registration and opt-out handling before any work.

## Accessibility and localization

Public pages need FR/EN parity, one `h1`, alt text, labelled controls, correct `lang`, mobile-first layout, keyboard operability and empty/loading/error states. Verify QR and Wallet screens at phone width, and run assistive-technology and contrast checks (not yet run, see PROJECT_STATUS).
