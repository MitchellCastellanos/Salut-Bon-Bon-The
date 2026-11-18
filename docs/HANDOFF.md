# Engineering handoff

The commercial implementation is on `feat/official-catalog-neon-marketing`. It includes the official bilingual catalog, campaign pages, ADMIN catalog and pickup settings, opt-in analytics, and pay-at-pickup checkout. The credential-free demo uses separate data and a separate cart. STAFF can fulfill orders, and ADMIN controls commercial configuration.

## Verification

Migrations 001–004 and the repeat import passed against a disposable PGlite PostgreSQL-wire database. Demo, staff authorization, and commercial browser smoke tests passed during implementation. Final handoff checks passed ESLint, TypeScript, eight automated tests, and the production build. See [Testing](TESTING.md) for commands and fixture requirements.

## Next engineering step

Start with [Launch readiness](LAUNCH_READINESS.md). When Neon access is available, follow [Neon setup](NEON_SETUP.md) and the [catalog import guide](CATALOG_IMPORT_GUIDE.md) on an isolated migration-testing branch. Keep production checkout disabled while the owner approves settings and media. See the [image manifest](IMAGE_ASSET_MANIFEST.md) for the expected assets and [Provider activation](PROVIDER_SETUP.md) for the remaining Stripe, Resend, optional Twilio, and Vercel work. Récompenses Salut and Salut Rewards remain a preview.
