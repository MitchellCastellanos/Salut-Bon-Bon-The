# Database schema

[001-orders.sql](../db/001-orders.sql) creates orders and order_events. The identity number is public. The unique request UUID and request fingerprint protect order submission retries. The tracking token is a unique 256-bit bearer value. Immutable item snapshots hold localized names, selections, quantities and cent subtotals. Order status and payment status have independent constraints. The pickup and creation indexes support future slot queries and the staff feed.

Initial event and order insert share a statement. Every status change compares the expected state and inserts the event in the same statement. Pickup settlement is a guarded update. Staff actor history, persistent settings, customers, ledger, refund events and notification outbox are pending. The future payment aggregate should uniquely index Stripe session IDs and webhook event IDs. Loyalty awards and redemptions should use unique origin keys and balance checks in the same transaction.

[002-staff-auth.sql](../db/002-staff-auth.sql) adds Better Auth user, session, account and verification tables with indexed relationships and constrained CUSTOMER, STAFF and ADMIN roles. Each operator-created credential account and its user are inserted atomically. Auth sessions are persisted in the configured PostgreSQL database and read alongside the current user role. Apply 002 once after 001 to the configured database. The private PGlite demo still initializes only 001.

## Official catalog

Migration 003 adds categories, products, two translation rows per seeded product, variants, modifier group/eligibility tables, reusable collections, image and placement tables, campaign scheduling and localized copy, event storage, store settings and audit history. Migration 004 adds tax_cents to orders with zero for historical rows. Better Auth is untouched. Orders retain bilingual names and selected modifiers, item subtotals, taxes and the accepted total.

## Migrations 005–007 (2026-11-18)

- [005](../db/005-payments-notifications.sql): `payment_attempts`, `provider_events`, `email_outbox`, `orders.customer_email`, `orders.payment_method`, extended `orders.payment` states.
- [006](../db/006-accounts-loyalty.sql): `orders.customer_user_id`, `rate_limits`, `loyalty_program`, `loyalty_rewards`, `loyalty_accounts`, `loyalty_transactions`, `loyalty_qr_tokens`, functions `loyalty_post` and `loyalty_redeem`; marks existing staff as email-verified. No gift-card objects.
- [007](../db/007-append-only-history.sql): append-only history (revokes and `loyalty_transactions_append_only` trigger).

The pickup policy stored in `catalog_store_settings.pickup_policy` gained `slotMinutes`, `advanceDays`, `sameDayCutoff` and `exceptions` (see [Scheduling](SCHEDULING.md)); older documents remain valid.

## Migration 009 (Salut Rewards 5 %)

[009](../db/009-rewards-five-percent.sql): lifecycle flags on `loyalty_program` (`preview_visible`, `accrual_enabled`, `redemption_enabled`, `commercial_authorized` with who/when); `loyalty_rewards.discount_cents` and `preview_visible`; preview seed (rate 10, reward `rabais-5` = 1,000 points / 500 cents, **not offered**, program inactive); guest cards (`loyalty_accounts.user_id` nullable, `guest_secret_hash`, `linked_at`, `merged_into`, status `merged`); `orders.loyalty_account_id`; `loyalty_transactions.eligible_cents` and kind `reverse`; append-only `loyalty_refund_events`; `loyalty_post` replaced by a 10-argument version (the old 9-argument one is dropped); `loyalty_redeem` honours `redemption_enabled`; new `loyalty_reverse_refund` and `loyalty_link_guest`. Applied and tested on local PostgreSQL 16 (empty database, plus a least-privilege `salut_app` check); **not applied to Neon**.

## Migration 010 (free-drink stamp card)

[010](../db/010-stamp-card.sql): no schema change. Clears existing balances through ledger `adjust` rows (actor `system:migration-010`; aborts if the program is commercially authorized and balances exist), withdraws reward `rabais-5` (`available` and `preview_visible` false) and inserts reward `free-drink` (9 units, offered, public). A balance unit is now one stamp; `loyalty_program.points_per_dollar` is unused.
