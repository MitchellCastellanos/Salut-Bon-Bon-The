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

## Stripe (implemented 2026-11-18, test mode only)

- Checkout Sessions are created server-side from the stored, server-priced order (`src/card-checkout.ts`), one per order (idempotency key `salut-checkout:<order>`), expiring after 30 minutes. Line items plus a tax line must add up to the order total or the order is cancelled and its slot released.
- Webhook endpoint: `https://<site>/api/stripe/webhook`. Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`. Signature, mode, amount, currency and reference are verified; replays are no-ops; events that arrive before their ledger row return 503 so Stripe retries.
- Card payment is offered only when `SALUT_STRIPE_TEST_ENABLED=1`, `STRIPE_SECRET_KEY` starts with `sk_test_` and `STRIPE_WEBHOOK_SECRET` is set. Live mode additionally needs `STRIPE_MODE=live`, an `sk_live_` key and `SALUT_LIVE_PAYMENTS_APPROVED=1`. **Do not set the live variables until the owner approves.**
- Not implemented: automated refunds (cancelled paid orders are flagged `REFUND_REQUIRED` for manual refund), Stripe Tax, saved cards.

## Resend (implemented 2026-11-18, test mode only)

- Transactional kinds: customer confirmation, store notification, ready for pickup, cancelled. French and English, branded. Stored in `email_outbox` with one row per `(order, kind)`, sent with Resend idempotency keys, retried by `/api/notifications/run` (daily Vercel cron, `CRON_SECRET`).
- Pay-at-pickup orders send confirmations on placement; card orders send them once payment is settled.
- Customer email is optional and used only for the order. No marketing consent is collected or implied. Marketing email must be a separate, opt-in system.
- Test mode (`SALUT_RESEND_TEST_ENABLED=1`) delivers only to `RESEND_TEST_RECIPIENT`; other recipients are recorded as `SKIPPED`. Live mode needs `RESEND_MODE=live` and `SALUT_LIVE_EMAIL_APPROVED=1`.
- Needs a Resend domain verified for `RESEND_FROM` (the sandbox could not confirm one).

## Twilio

SMS is not implemented: it is not a launch requirement and would need a consent flow and a number. Revisit after launch.

## Account email and test hooks (2026-11-18)

Verification and password-reset emails use the same Resend configuration and test/live gates as order email. `SALUT_EMAIL_CAPTURE_DIR` writes them to files instead of sending; it is ignored when `VERCEL_ENV` is `production` or `preview`. Customer registration is hidden behind an accurate "unavailable" message until Resend is configured, because accounts cannot be verified without email.
