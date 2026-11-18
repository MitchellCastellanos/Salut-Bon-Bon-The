# Security

Tracking uses random bearer links and serves a narrow status projection. Private pages discourage indexing and send a no-referrer policy. Checkout validates and reprices on the server. Staff pages and mutations resolve an expiring Better Auth session and check the current role in PostgreSQL on each request. STAFF and ADMIN can handle orders. Public sign-up is disabled, and the operator provisions accounts through the CLI. The private local demo uses a separate signed cookie and its documented demo password. No live payments or external notifications run.

Before public release add abuse controls and rate limits for authentication and ordering, staff and payment audit, data retention and deletion workflows, and review handling of Quebec privacy and Canadian anti-spam obligations. The platform has not undergone legal or security review.
