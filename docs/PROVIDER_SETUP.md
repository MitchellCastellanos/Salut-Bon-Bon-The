# Provider activation

## Stripe

The test adapter under `src/providers/stripe.ts` uses the Stripe SDK to create a CAD Checkout session with an idempotency key and verify raw signed webhook bodies. Reconciliation checks the stored session, order, currency, amount and paid status. The adapter only accepts a test secret key and rejects live webhook events.

Before wiring an endpoint, add a stored payment-attempt record and a unique Stripe event ID. In one transaction, record the event and apply the paid transition only after matching the stored session and order total. A browser redirect only shows that the customer returned. Cover replay, pending and failed sessions, and mismatches in a Stripe test environment. Configure test credentials securely with the feature flag disabled until testing. Current checkout continues to use pay at pickup.

## Resend

The test adapter under `src/providers/order-notices.ts` formats bilingual confirmation and ready messages and permits delivery only to the configured test recipient. Use a verified sender and a synthetic order. Add a transactional outbox keyed by order, notification type and channel before wiring sends. Collect the customer email and document its handling before enabling production delivery. Demo flows do not call the adapter.

## Twilio (optional)

Add SMS only after separate opt-in, consent recording, number verification, the applicable messaging registration, and supported opt-out handling. Reuse the notification outbox and bilingual order notices. Test failures and retry with provider test credentials or approved test numbers. No SMS adapter is active.

## Vercel

Use a staging project or protected preview connected to Neon development. Provide DATABASE_URL, BETTER_AUTH_URL for the exact browser-facing origin, BETTER_AUTH_SECRET, and an authorized SITE_URL through project configuration. Apply migrations and import through a separate deployment step. Keep preview credentials and data isolated from production. Leave provider flags and pickup checkout off until the corresponding checklist items pass. Verify both locales, private receipt, staff sign-in and preview database selection before assigning the production domain.
