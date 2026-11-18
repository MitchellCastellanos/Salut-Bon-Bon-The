# Launch readiness

Production checkout stays disabled until hosted validation and owner sign-off. This handoff covers the commercial implementation on `feat/official-catalog-neon-marketing`.

## Completed and verified locally

- [x] Searchable French and English catalog with 62 products, 124 product translations, 18 modifiers, collection pages, and four campaigns.
- [x] Better Auth STAFF and ADMIN authorization, server-side role checks, ADMIN catalog and campaign editing, and staff order fulfillment.
- [x] Pay-at-pickup checkout with approved server-side pricing, tax calculation, price-change reconfirmation, atomic slot capacity checks, and private tracking.
- [x] Opt-in first-party campaign analytics and ADMIN reporting.
- [x] Migrations 001–004 and repeated catalog import against a disposable PGlite PostgreSQL-wire fixture. Demo, staff authorization, and commercial browser smokes passed during implementation. Final handoff verification passed ESLint, TypeScript, eight automated tests, and the production build.

## Pending before launch

- [ ] Provision isolated Neon production, development, and migration-testing branches. Rehearse migrations and repeat imports on the test branch before applying them to development.
- [ ] Provision hosted ADMIN accounts. Enter owner-approved prices, availability, modifier eligibility, Montréal pickup hours, lead time, capacity, and tax settings.
- [ ] Review edge protections and configure trusted per-client rate limits. Checkout currently uses a shared database-backed limit.
- [ ] Wire payment and notification persistence. Stripe and Resend have test-only adapters. Verify Stripe reconciliation and replay protection, and test Resend with a verified sender and synthetic recipients. Twilio remains optional and unconfigured.
- [ ] Approve final photography, brand assets, campaign copy, and legal and privacy materials, including analytics consent and retention.
- [ ] Configure and validate Vercel staging, production domain and DNS. Run hosted smoke tests and obtain owner sign-off.
- [ ] Review the unresolved transitive `picomatch` advisory GHSA-fc5q-39xc-vjpf. The npm audit proposed a breaking Vitest downgrade, which was deferred.

See [Neon setup](NEON_SETUP.md), [Provider activation](PROVIDER_SETUP.md), and [Testing](TESTING.md) for instructions and evidence.
