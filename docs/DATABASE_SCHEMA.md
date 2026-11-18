# Database schema

[001-orders.sql](../db/001-orders.sql) creates orders and order_events. The identity number is public. The unique request UUID and request fingerprint protect order submission retries. The tracking token is a unique 256-bit bearer value. Immutable item snapshots hold localized names, selections, quantities and cent subtotals. Order status and payment status have independent constraints. The pickup and creation indexes support future slot queries and the staff feed.

Initial event and order insert share a statement. Every status change compares the expected state and inserts the event in the same statement. Pickup settlement is a guarded update. Staff actor history, persistent settings, customers, ledger, refund events and notification outbox are pending. The future payment aggregate should uniquely index Stripe session IDs and webhook event IDs. Loyalty awards and redemptions should use unique origin keys and balance checks in the same transaction.
