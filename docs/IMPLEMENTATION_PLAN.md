# Implementation plan

1. Foundation and pickup vertical slice. Verify a bilingual customer can customize a drink, order and track it while staff move the order through service.
2. Store operations. Staff Better Auth and migration 002 are implemented. Rehearse both migrations on Neon, then add admin-only pickup settings with hours, pause and capacity enforcement, product and promotion management, and operational audit.
3. Customer accounts and Récompenses Salut / Salut Rewards. Add a transactional ledger, expiring redemption confirmations and authorized staff scanning.
4. Test Stripe Checkout and notification providers. Verify retries and idempotency before activating external sends.
5. Consent-aware website analytics and owner reporting.
6. Add the approved photos and vector logo using the [image manifest](IMAGE_ASSET_MANIFEST.md) and verify media crops. Verify accessibility, SEO, performance and deployment. Review legal placeholders and business data with the owner.
