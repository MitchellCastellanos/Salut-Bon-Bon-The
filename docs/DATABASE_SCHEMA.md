# Database schema

[001-orders.sql](../db/001-orders.sql) creates orders and order_events. The identity number is public. The unique request UUID and request fingerprint protect order submission retries. The tracking token is a unique 256-bit bearer value. Immutable item snapshots hold localized names, selections, quantities and cent subtotals. Order status and payment status have independent constraints. The pickup and creation indexes support future slot queries and the staff feed.

Initial event and order insert share a statement. Every status change compares the expected state and inserts the event in the same statement. Pickup settlement is a guarded update. Staff actor history, persistent settings, customers, ledger, refund events and notification outbox are pending. The future payment aggregate should uniquely index Stripe session IDs and webhook event IDs. Loyalty awards and redemptions should use unique origin keys and balance checks in the same transaction.

[002-staff-auth.sql](../db/002-staff-auth.sql) adds Better Auth user, session, account and verification tables with indexed relationships and constrained CUSTOMER, STAFF and ADMIN roles. Each operator-created credential account and its user are inserted atomically. Auth sessions are persisted in the configured PostgreSQL database and read alongside the current user role. Apply 002 once after 001 to the configured database. The private PGlite demo still initializes only 001.

## Official catalog

Migration 003 adds categories, products, two translation rows per seeded product, variants, modifier group/eligibility tables, reusable collections, image and placement tables, campaign scheduling and localized copy, event storage, store settings and audit history. Migration 004 adds tax_cents to orders with zero for historical rows. Better Auth is untouched. Orders retain bilingual names and selected modifiers, item subtotals, taxes and the accepted total.
