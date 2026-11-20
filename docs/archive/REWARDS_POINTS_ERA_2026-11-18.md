> **ARCHIVED, HISTORICAL (2026-11-20).** This is the former `docs/REWARDS.md`. Its opening "stamp card" section and the accounts, QR and security sections are still broadly accurate; the **"Salut Rewards 5 %" part (points, $5 reward, calculator, formulas) is superseded** by migration 011 and must not be read as current behaviour. Current rules: [PRODUCT_SPEC.md](../PRODUCT_SPEC.md#salut-rewards-91). Current mechanics: [TECHNICAL.md](../TECHNICAL.md#loyalty-engine-and-customer-accounts). Kept unchanged below for the record.

# Customer accounts and Récompenses Salut / Salut Rewards

FR **Récompenses Salut**, EN **Salut Rewards**: one loyalty program. Gift cards are out of scope for this phase: there are no gift-card tables, issuance, balances or redemption anywhere in the schema or code.

# Salut Rewards: free-drink stamp card, 9 + 1 (migration 011, 2026-11-19)

**Current program.** Every eligible drink earns one stamp; after 9 stamps the 10th drink is free. This is option A of the [commercial proposal](LOYALTY_PROPOSAL_2026-11-18.md) and **replaces** the points scheme (10 points per $1, $5 reward) described in the "5 %" section below, which is kept as history. Where the older text below says "points", read "stamps".

## How it is built

- **Same ledger, new unit.** One stamp is one unit of `loyalty_accounts.balance`. Accounts, guest cards, QR tokens, `loyalty_post`, `loyalty_redeem`, `loyalty_reverse_refund`, `loyalty_link_guest`, append-only history and idempotency are reused unchanged, so every concurrency and permission guarantee still applies.
- **The reward.** `loyalty_rewards.free-drink` ("Boisson gratuite" / "Free drink") costs **9** stamps (`stampsForReward` in `src/rewards-math.ts`), is offered by default and still only redeemable when an ADMIN activates the program. Redeeming deducts 9; stamps beyond 9 carry over to the next card. The old `rabais-5` reward is withdrawn (not offered, not listed).
- **Earning online.** When STAFF mark an order COMPLETED, `earnForOrder` credits `min(total drink quantity, maxStampsPerOrder = 10)` stamps (one earn per order, key `earn:order:<n>`). Only items in the ADMIN-selected categories count (none selected = all) and the order must reach the optional minimum purchase. The pre-tax eligible cents are stored on the ledger row so refunds can take stamps back proportionally (`floor(earned x remaining / eligible)`, a full refund takes all, never below zero).
- **Earning in store.** After the QR scan, STAFF enter the number of eligible drinks bought (1 to 10, free drink excluded) instead of a dollar amount (`awardInStore({ drinks })`). Idempotent per form key.
- **No earning rate.** `loyalty_program.points_per_dollar` is no longer read or written (the column stays so earlier migrations remain valid). ADMIN program rules are now: active, preview visible, earning allowed, redemption allowed, owner authorization, minimum purchase and drink categories.
- **Migration 011** clears any balance left from the points preview through the append-only ledger (`adjust`, actor `system:migration-011`). It **aborts** if the program is already commercially authorized and balances exist, so real balances are never silently reinterpreted; convert them by hand in that case.

## Progress bar

`src/stamp-progress.tsx` renders `<StampProgress balance lang/>` from the balance only: a gradient bar (`role="progressbar"`, `aria-valuenow/max`), ten slots (9 stamps + a gift slot for the free drink), a bilingual message ("3 more drinks and your next one is free!", "Your free drink is ready!", extra stamps shown as carried over) and a highlighted state when a free drink is ready. It is used on `/account`, `/account/rewards`, the guest card, the staff counter and, as a clearly labelled illustrative example (6 of 9), on the public page. Optional artwork in `public/rewards/stamp-filled.webp`, `stamp-empty.webp` and `stamp-free.webp` replaces the built-in SVG icons when present (prompts: [BATCH-07](../image-prompts/BATCH-07.md)). Cart, product and home copy now speak of stamps; the public calculator was removed because there is no rate to simulate.

## Owner decisions still open

Eligible drinks (categories), maximum value of the free drink, cap per order (10 is a placeholder), combination with promotions, expiry, and refunds after redemption (a shortfall is recorded, never a negative balance).

## Customer accounts

- Registration, sign-in, sign-out, email verification, password reset, profile (name) and order history live under `/{fr|en}/account`.
- A **second Better Auth instance** (`customerAuth()` in `src/auth.ts`) serves customers, with its own cookie prefix `salut-customer`, mandatory verified email, 12-character minimum passwords, 14-day sessions, and a session hook that **refuses STAFF and ADMIN identities**. The staff instance (`staffAuth()`) is unchanged and refuses non-staff, so each population can only sign in through its own door. Staff role checks (`staffRole()`) read the staff session only, so a customer can never obtain a staff or admin permission. Migration 006 marks existing staff and admins as email-verified; `npm run staff:create` now does too.
- Better Auth's HTTP handler is **not** mounted: all flows are server actions that call `auth.api.*`, so no extra public auth endpoints exist.
- Verification is a button on the verify page, not a GET side effect, so mail scanners that prefetch links cannot consume the token. Verification and reset links expire after 1 hour. Registration, sign-in, reset and verification responses do not reveal whether an address has an account.
- Account emails (`src/account-email.ts`) are bilingual (FR and EN in one message), transactional only, and obey the same test/live gates as order email (`RESEND_MODE`, `SALUT_LIVE_EMAIL_APPROVED`, test recipient). Registration is offered only when verification email can actually be delivered; otherwise the page states that accounts are unavailable because email is not configured.
- A signed-in customer's orders are linked (`orders.customer_user_id`), prefill the account email for order notices, appear in order history, and earn points.
- Rate limits (`src/rate-limit.ts`, PostgreSQL fixed windows, subjects hashed): register 5/h per IP and 3/h per email; sign-in 20/15 min per IP and 8/15 min per email; forgot-password 5/h per IP and 3/h per email; reset 10/h per IP; QR issuance 20/10 min per customer; staff redeem 30/min and award 60/min per staff member.

## Program model (migration 006)

| Table | Purpose |
| --- | --- |
| `loyalty_program` | Singleton: `active` (default **false**), `points_per_dollar` (default **NULL**), `earn_categories`, `min_order_cents`. |
| `loyalty_rewards` | Reward definitions: FR/EN names and descriptions, `points_cost`, `available` (default false), optional eligible category or product. None are seeded. |
| `loyalty_accounts` | One per user: non-secret `member_code` (8 characters), `balance` (never negative), `lifetime_earned`, `status`. |
| `loyalty_transactions` | Append-only ledger: `earn`, `redeem`, `adjust`, `balance_after`, unique `idempotency_key`, one `earn` per order, actor, reason. |
| `loyalty_qr_tokens` | Single-use identification tokens, stored only as SHA-256 hashes. |

**Safe defaults:** the program ships **inactive**. Migration 009 pre-loads the preview terms (10 points per $1 and one unoffered $5 reward, see below), but nothing can be awarded or redeemed until an ADMIN activates the program. The admin cannot activate it without an earning rate, and in production activation also needs the recorded owner authorization.

All balance changes go through two PL/pgSQL functions that lock the rows involved:

- `loyalty_post(...)` (10 arguments since migration 009, adds the eligible base): locks the account row, returns the prior result for a repeated idempotency key (and rejects the same key with different values), rejects suspended accounts for earn/redeem, rejects any change that would make the balance negative, inserts the ledger row and updates the balance in one transaction.
- `loyalty_redeem(...)`: locks the token row first, then calls `loyalty_post`; fails with `QR_INVALID`, `QR_USED`, `QR_EXPIRED`, `PROGRAM_INACTIVE`, `REWARD_UNAVAILABLE`, `INSUFFICIENT_POINTS` or `ACCOUNT_SUSPENDED`, and marks the token redeemed in the same transaction.

Migration 007 makes history **append-only**: the runtime role has no UPDATE or DELETE on `loyalty_transactions`, `order_events`, `catalog_audit_history` or `provider_events`, and a trigger rejects any UPDATE/DELETE on `loyalty_transactions` for every role.

## Earning

- **Online orders:** when staff mark an order COMPLETED, `earnForOrder` awards `floor(eligible_cents × points_per_dollar / 100)` on the pre-tax subtotal of eligible items (optionally limited to categories, subject to a minimum purchase). Key `earn:order:<n>` plus a unique index make it once per order. Guest orders, unenrolled customers, inactive programs and suspended accounts earn nothing.
- **In store:** after a QR scan, staff enter the pre-tax amount; the same rule applies with a per-form idempotency key.
- **Manual adjustments** (ADMIN only) require a reason of at least 3 characters and are permanent history.

## QR identification and redemption

1. The customer opens `/account/rewards`. A server action issues a random 32-byte token (valid 5 minutes, single use) and renders a QR whose payload is only `https://<site>/{lang}/staff/rewards?t=<token>`. It contains no name, email, member number, password or session. Issuing a new code invalidates the previous unredeemed one, and the card refreshes itself when the code expires.
2. At the counter, staff scan with any camera app (or paste the link). The staff page requires a staff sign-in, then shows first name, member code, balance and the available rewards. Identification does not consume the token.
3. Staff press **Confirm redemption**. The form carries a per-render idempotency key, so a double click returns the same result instead of charging twice. The token is consumed, points are deducted atomically, and the reward name and staff actor are recorded. Reusing the token, replaying after expiry, or scanning a superseded code is refused.
4. Staff hand over the reward at the counter. Rewards are **not** applied to online checkout totals, so pricing, tax and payment protections are untouched.

Fraud controls: hashed single-use short-lived tokens, atomic row locks, idempotency, rate limits, suspended-account status, append-only audit history, ADMIN-only adjustments, and no personal data in the QR.

## Admin (`/{lang}/admin/rewards`, ADMIN only)

Program activation, points per dollar, minimum purchase, earning categories; reward create/edit/availability with eligible category or product; customer lookup by email or member number with full history; audited adjustments with reason; account suspension; latest redemptions. Program and reward changes are written to `catalog_audit_history` with the acting user. Staff (non-admin) can only use `/staff/rewards` (identify, redeem, award).

## Branding

`src/brand.tsx` renders the official logo from `public/brand/logo.svg` when present, otherwise the typographic wordmark. It is used in the header, footer and mobile navigation (one responsive header), account pages, the checkout panel and the loyalty QR card. Order and account emails use `public/brand/logo-email.png` (PNG, because email clients reject SVG) and otherwise the wordmark. The favicon and social preview use the official logo when supplied; the social preview otherwise sets the brand name in type. No logo was invented.

## Verification

`tests/loyalty.test.ts` (enrolment, defaults, earning rules, QR lifetime, redemption, replay, insufficient balance, isolation, adjustments), `tests/loyalty-concurrency.test.ts` (real PostgreSQL: parallel redemptions never overspend, one scan wins per token, same-key parallel submits deduct once, parallel earn once), and `tests/rewards-browser-smoke.mjs` (full browser flow, see [Testing](../TECHNICAL.md#testing)).


---

# Salut Rewards 5 % (migration 009, 2026-11-18)

Commercial comparison of the two proposals: [Loyalty commercial proposal](LOYALTY_PROPOSAL_2026-11-18.md) (French). **Option B (this program) is the one implemented for the preview; option A (9 + 1 stamp card) is a proposal only and has no code.**

## 1. Real architecture

PostgreSQL stays the single source of truth; no second rewards store exists. The pure arithmetic lives in `src/rewards-math.ts` (no I/O, shared by the server, the public calculator and the tests). `src/loyalty.ts` owns reads, earning, refund reversal, guest cards and configuration saving. SQL functions do every balance change. Pages: public `/fr/recompenses` and `/en/rewards` (`src/rewards-page.tsx`), guest card `/fr/recompenses/carte` and `/en/rewards/card` (`src/guest-card-page.tsx`), customer `/account/rewards` (reused, now also links guest cards), STAFF `/staff/rewards`, ADMIN `/admin/rewards`.

## 2. Data model (additions)

| Object | Purpose |
| --- | --- |
| `loyalty_program.preview_visible / accrual_enabled / redemption_enabled / commercial_authorized(+_at,_by)` | Separate lifecycle flags. `active` remains the master operations switch. |
| `loyalty_rewards.discount_cents / preview_visible` | Monetary value of a reward (informational, applied at the counter) and public listing. Seed: `rabais-5`, 1,000 points, 500 cents, **not offered**. |
| `loyalty_accounts.user_id` nullable, `guest_secret_hash`, `linked_at`, `merged_into`, status `merged` | Guest cards. A guest account has no user; its secret is stored only as SHA-256. |
| `orders.loyalty_account_id` | Online order attached to a guest card (never overrides a signed-in member's order). |
| `loyalty_transactions.eligible_cents`, kind `reverse` | The eligible base recorded on each order earn; refund reversals. |
| `loyalty_refund_events` (append-only) | One row per recorded refund: pre-tax refunded cents, points reversed, shortfall, idempotency key, reason, actor. |
| Functions `loyalty_reverse_refund`, `loyalty_link_guest` | Atomic refund reversal and guest-to-account link. |

## 3. Points formula and 4. rounding

`points = floor(eligible_cents × points_per_dollar / 100)`, computed **once per order** on the whole eligible pre-tax subtotal (never per line, never rounded up), in integer cents. With 10 points per $1: `floor(cents / 10)`; 10.99 $ → 109 points; 0.09 $ → 0. The effective return is derived, not hard-coded: `points_per_dollar × reward discount ÷ reward cost` = 10 × 500 ÷ 1,000 = **5 %**. Excluded: taxes, tips, discounts (the base is the order's pre-tax item subtotal; in store, staff enter the amount after discounts and without tip), redeemed rewards, refunded amounts and cancelled orders. Eligible categories and a minimum purchase are optional ADMIN settings.

## 5. Earning flow

- **Online:** staff mark the order COMPLETED → `earnForOrder` (only COMPLETED orders earn; one earn per order by key `earn:order:<n>` and a unique index). The order must be linked to a verified member (`customer_user_id`) or a guest card (`loyalty_account_id`). An order completed while earning is off or the program is inactive earns nothing and is **not** back-filled later.
- **In store:** staff identify the QR, enter the pre-tax amount (after discounts, excluding tip); idempotency key per form render.

## 6. Redemption flow

Counter only. The customer shows a single-use QR (5 minutes); staff identify it (first name, member code and balance; guests appear as "Invité / Guest"), confirm the redemption (points deducted atomically; reward name and staff actor recorded) and apply the discount in the till (the reward shows its dollar value). **The discount is not applied to online checkout totals**, so pricing, tax and payment logic are untouched, and the site never claims otherwise. Redemption requires: program active, `redemption_enabled`, reward offered, enough points, live unused QR, account active.

## 7. Guest experience (no login)

Discovery needs no login: the public page and calculator use no personal data. **Participation without an account** uses a *guest card*: `POST` from `/recompenses/carte` creates an account row with `user_id NULL` and a random 256-bit secret. The secret is kept in an httpOnly, SameSite=Lax cookie and shown once as a **backup code**; the database stores only its hash (authoritative; local storage is not used). The card issues the same short-lived QR as a member. Online orders placed from that browser attach to the card. Evaluated and **not** implemented: claiming a purchase from a receipt/tracking code (anyone holding the private tracking link could claim it) and any phone-number identification. Lost cookie and lost backup code mean a lost card (documented limitation; linking to an account early avoids it).

**Link to an account** (`/account/rewards` while signed in with a guest card on the browser): `loyalty_link_guest` locks both accounts; with no existing member account the card becomes that account; otherwise the balance is moved through two ledger `adjust` entries (`link-out:`/`link-in:` keys), pending orders follow, the card is marked `merged` and its secret erased. A second attempt fails with `GUEST_NOT_FOUND`; points are never copied.

## 8. QR and identification

Unchanged engine: random 32-byte token, SHA-256 at rest, 5-minute single-use, superseded by a newer one, payload is only a URL with the token. The member code is **not** a credential anywhere (restore and staff lookup reject it). Staff screens now explain an unusable scanned code instead of silently ignoring it.

## 9. Security and privacy

No names, emails, balances, account or order data on public pages (tested by rendering both pages next to seeded private rows). No enumeration: guest/restore responses reveal nothing about other cards; restore is rate limited (10/15 min per address), card creation 5/h per address, linking 10/h per customer. 256-bit secrets cannot be brute-forced; the staff-only member code is 8 characters from a 32-symbol alphabet and is never accepted as proof. Append-only ledger and refund history (trigger plus revoked UPDATE/DELETE for `salut_app`). The least-privilege role needs `UPDATE` on `orders` (already required by the app) for `loyalty_link_guest`.

## 10. Refunds and reversal

ADMIN records a refund of the **pre-tax** amount against an online order that earned points (`/admin/rewards`, idempotency key per form). `points kept = floor(earned × (eligible − cumulative refunds) ÷ eligible)`; reversed points = earned − kept − already reversed, so a full refund removes every point and several partial refunds converge to the same total without rounding drift. The balance is never negative: points already spent are recorded as **shortfall** (visible to the admin, no negative balance, no automatic clawback). Cumulative refunds above the eligible base are refused (`REFUND_EXCEEDS_PURCHASE`). In-store purchases and non-earning orders use a manual audited ADMIN adjustment. Nothing links Stripe refunds to this automatically (no refund API integration exists in the app; payment state `REFUND_REQUIRED` is only a flag).

## 11. ADMIN configuration

`/{lang}/admin/rewards`: five-state panel; program form (preview visible, active, earning allowed, redemption allowed, commercial authorization, points per dollar, minimum purchase, categories); reward form (names, descriptions, cost, dollar value, eligibility, offered, preview visible); refund form; customer lookup (members and guest cards by member code) with audited adjustments, suspension and history. Every program/reward/account change writes `catalog_audit_history` with the actor. In production (`VERCEL_ENV=production`) activating requires the authorization box; that box records who and when.

## 12. STAFF operations

Scan or paste the link, identify, award points on the pre-tax amount, confirm a redemption (then apply the dollar discount in the till), with clear localized errors (`QR_INVALID/USED/EXPIRED`, insufficient points, program inactive, earning/redemption disabled, suspended, rate limit). Double submits are idempotent. STAFF cannot reach ADMIN pages or actions.

## 13. Tests

`tests/rewards-five-percent.test.ts` (31: arithmetic, rounding, seed state, states, 5 % earning, duplicates, cancelled orders, guests, secure identification, link, QR expiry, duplicate redemption, insufficient points, inactive program/reward, refunds, ADMIN config); `tests/rewards-public.test.tsx` (rendered public pages FR/EN, no private data, metadata); `tests/rewards-permissions.test.ts` (STAFF/visitor/customer role gates); `tests/loyalty-concurrency.test.ts` (real PostgreSQL, now also parallel refunds and parallel guest links); `tests/rewards-public-smoke.mjs` (browser at 390 px and 1280 px, FR/EN, guest card, counter flow, cart hint). See [Testing](../TECHNICAL.md#testing).

## 14. External dependencies

Neon PostgreSQL (migration 009 must be rehearsed on a test branch first; **not applied to Neon by this change**). Better Auth + Resend for customer accounts (registration stays unavailable until email is configured; **guest cards and the public page need neither**). No payment dependency: online card payment is unchanged and rewards never touch it. No POS integration exists.

## 15. Production state

Nothing is active. Program inactive, reward not offered, authorization not recorded, migration 009 not applied to production. The public page is a labelled preview.

## 16. Owner decisions pending

Rate and reward confirmation, eligible categories, minimum purchase, expiry policy (none today), promotion stacking, commercial authorization and launch date, automatic online discount (not built), legal/privacy copy, accountant opinion on the discount's tax treatment. Details: [commercial proposal](LOYALTY_PROPOSAL_2026-11-18.md#6-décisions-attendues-du-propriétaire).

## 17. Preview versus active program

| State | Meaning | Where set |
| --- | --- | --- |
| Configured | A rate exists (seed: 10 points/$1) | `points_per_dollar` |
| Public preview visible | Page, nav, home banner and sitemap show it | `preview_visible` |
| Earning operational | `active` and `accrual_enabled` and a rate | ADMIN |
| Redemption operational | `active` and `redemption_enabled` | ADMIN |
| Commercial activation authorized | Owner sign-off recorded; required to activate in production | ADMIN checkbox |

A reward is shown as *Available* only when the program, redemption and the reward are all on; offered but not operational → *Coming soon*; not offered on an active program → *Unavailable*.
