# Deployment

Vercel and Neon are target services. The local PGlite demo needs writable disk and one application process. For any Vercel test environment apply SQL migrations 001 and 002 in a Neon test branch, configure DATABASE_URL, BETTER_AUTH_URL and BETTER_AUTH_SECRET, provision individual staff accounts, and smoke-test checkout, status updates and tracking. Keep deployments private until authentication rate limiting, operational controls and demo catalog isolation are ready. Set SITE_URL to the validated domain once approved. Keep the previous application deployment and database recovery point before changing schema. Rollback and migration recovery have yet to be rehearsed. Stripe webhook, Resend, Twilio and production domain setup are pending.

## Environments, deploys and rollback (2026-11-18)

| Vercel target | Database | Notes |
| --- | --- | --- |
| Preview | Neon `development`, role `salut_app` (Preview-only sensitive `DATABASE_URL`) | Behind Vercel SSO. Synthetic data only. |
| Production | Not configured yet | Fails closed: `src/db.ts` refuses demo storage when `VERCEL_ENV` is `production` or `preview` without `DATABASE_URL`. Orders are impossible until it is set. |

- Never share secrets between targets. Production variables are created with target `production` only. Never copy the owner role to Vercel.
- Migrations run only from `npm run db:migrate` on a trusted machine or a manually triggered job. The build and requests never migrate.
- Build observability: Vercel deployment logs and `get_runtime_errors`. The webhook logs `stripe amount mismatch` and `stripe webhook failed` with order and event ids only (no PII, no secrets).
- Application rollback: promote the previous READY deployment (Vercel Instant Rollback). The last known-good production deployment is `dpl_GFMCzEuLEJ18acQRbdGKfA6G9oKU` (main at `d6860ad`, demo storage, no database). Database changes are additive, so the previous deployment keeps working against a newer schema; restore the Neon branch only for data corruption.
- Webhook: register `https://<production-domain>/api/stripe/webhook` and keep the production domain reachable without Vercel SSO.
- Checkout stays disabled until `pickup_checkout_enabled` is turned on by an ADMIN after the gates in `LAUNCH_READINESS.md`.

## Images and the Vercel image optimizer

`next.config.ts` sets `images.unoptimized: true`. Every file in `public/` is already an optimized WebP at its final size, so serving it directly is faster to operate and cannot hit Vercel's image-optimization limits. On the free plan those limits are small and every deployment resets the optimizer cache; when exceeded, `/_next/image` answers **402 Payment Required** and all photos disappear. Re-enable optimization only on a plan with sufficient quota, and keep source files small.
