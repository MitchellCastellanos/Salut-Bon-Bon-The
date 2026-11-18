# Security

Tracking uses random bearer links and serves a narrow status projection. Private pages discourage indexing and send a no-referrer policy. Checkout validates and reprices on the server. Staff pages and mutations resolve an expiring Better Auth session and check the current role in PostgreSQL on each request. STAFF and ADMIN can handle orders. Public sign-up is disabled, and the operator provisions accounts through the CLI. The private local demo uses a separate signed cookie and its documented demo password. No live payments or external notifications run.

Before public release add abuse controls and rate limits for authentication and ordering, staff and payment audit, data retention and deletion workflows, and review handling of Quebec privacy and Canadian anti-spam obligations. The platform has not undergone legal or security review.

## Audit 2026-11-18

Fixed in this change:

- **Demo storage in deployed environments.** `salut-bon-bon-the` had a READY Vercel production deployment with no `DATABASE_URL`, which would have run on the embedded PGlite demo (including simulated payments). `src/db.ts` now throws when `VERCEL_ENV` is `production` or `preview` without `DATABASE_URL`, unless `SALUT_ALLOW_DEMO=1`.
- **Payment truth.** Online payment state is written only by `applyStripeEvent` after `stripe.webhooks.constructEvent` verifies the signature and event mode. Amount, currency and order reference must match the stored attempt. Events are deduplicated in `provider_events` in the same atomic statement as the ledger update.
- **Completion and confirmation guards.** An order can only be completed when payment is settled, and a card order cannot be confirmed before Stripe settles it. Cancelling a paid card order sets `REFUND_REQUIRED` (refunds are manual in the Stripe dashboard).
- **Least privilege.** The runtime role cannot delete financial or audit history and has no DDL.
- **Email safety.** All user-supplied text is HTML-escaped; test mode can only reach `RESEND_TEST_RECIPIENT`; live mode needs `RESEND_MODE=live` and `SALUT_LIVE_EMAIL_APPROVED=1`.
- **Cron endpoint** compares `CRON_SECRET` in constant time and rejects secrets shorter than 32 characters.

### Dependency advisory GHSA-fc5q-39xc-vjpf (picomatch ReDoS)

- Vulnerable range `<=4.0.7`; the newest published version is 4.0.7, so **no patched release exists**. `npm audit` offers only a breaking downgrade of Vitest to 3.1.4, which still resolves picomatch, so it does not remove the finding.
- Reachability: picomatch arrives through Vitest/Vite/tinyglobby (test and lint tooling, pulled in transitively by `better-auth`). It is not imported by application code, does not appear in the Next.js build output, and no user-controlled glob reaches it. Exploitation requires an attacker-chosen extglob pattern in a developer tool.
- Mitigation: do not run those tools against untrusted patterns; CI fails only on critical advisories; re-check `npm audit` after each dependency update and bump picomatch as soon as a fixed release ships.

### Still open

- Rate limiting for checkout is a single shared database counter (60/min). Add per-client limits at the edge (Vercel Firewall) before launch.
- Staff sign-in has no explicit lockout beyond Better Auth defaults; add Vercel Firewall rate limits on `/fr/staff` and `/en/staff`.
- Server actions rely on Next.js origin checks for CSRF; no separate CSRF token is added.
- Vercel Deployment Protection (SSO) is enabled for the default `*.vercel.app` URLs; the Stripe webhook must be reachable, so use the production custom domain or a protection-bypass for the webhook path on previews.
