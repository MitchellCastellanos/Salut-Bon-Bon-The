# Customer accounts and Récompenses Salut / Salut Rewards

FR **Récompenses Salut**, EN **Salut Rewards**: one loyalty program. Gift cards are out of scope for this phase: there are no gift-card tables, issuance, balances or redemption anywhere in the schema or code.

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

**Safe defaults:** the program ships inactive with no rate and no rewards, so nothing can be awarded or redeemed until an ADMIN configures it. The admin cannot activate it without an earning rate.

All balance changes go through two PL/pgSQL functions that lock the rows involved:

- `loyalty_post(...)`: locks the account row, returns the prior result for a repeated idempotency key (and rejects the same key with different values), rejects suspended accounts for earn/redeem, rejects any change that would make the balance negative, inserts the ledger row and updates the balance in one transaction.
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

`tests/loyalty.test.ts` (enrolment, defaults, earning rules, QR lifetime, redemption, replay, insufficient balance, isolation, adjustments), `tests/loyalty-concurrency.test.ts` (real PostgreSQL: parallel redemptions never overspend, one scan wins per token, same-key parallel submits deduct once, parallel earn once), and `tests/rewards-browser-smoke.mjs` (full browser flow, see [Testing](TESTING.md)).
