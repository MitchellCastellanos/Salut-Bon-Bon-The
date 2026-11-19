# Engineering handoff

The commercial implementation is on `feat/official-catalog-neon-marketing`. It includes the official bilingual catalog, campaign pages, ADMIN catalog and pickup settings, opt-in analytics, and pay-at-pickup checkout. The credential-free demo uses separate data and a separate cart. STAFF can fulfill orders, and ADMIN controls commercial configuration.

## Verification

Migrations 001–004 and the repeat import passed against a disposable PGlite PostgreSQL-wire database. Demo, staff authorization, and commercial browser smoke tests passed during implementation. Final handoff checks passed ESLint, TypeScript, eight automated tests, and the production build. See [Testing](TESTING.md) for commands and fixture requirements.

## Next engineering step

Start with [Launch readiness](LAUNCH_READINESS.md). When Neon access is available, follow [Neon setup](NEON_SETUP.md) and the [catalog import guide](CATALOG_IMPORT_GUIDE.md) on an isolated migration-testing branch. Keep production checkout disabled while the owner approves settings and media. See the [image manifest](IMAGE_ASSET_MANIFEST.md) for the expected assets and [Provider activation](PROVIDER_SETUP.md) for the remaining Stripe, Resend, optional Twilio, and Vercel work. Récompenses Salut and Salut Rewards remain a preview.

## Update 2026-11-18 (accounts, rewards, scheduling)

Branch `claude/salut-bon-bon-the-launch-6a36qh`, draft PR #4 (the earlier `feat/official-catalog-neon-marketing` branch was already merged in PR #3). Added customer accounts and Récompenses Salut ([Rewards](REWARDS.md)), the visual business-hours editor with exceptional schedules and pickup settings ([Scheduling](SCHEDULING.md)), the ADMIN price sheet, cart quantity controls, brand integration points, BATCH-06 image prompts, migrations 006 and 007, and a Postgres-backed CI job. Gift cards are explicitly excluded. Next steps: owner approvals listed in [Launch readiness](LAUNCH_READINESS.md), supply the official logo, configure email and auth variables, then rehearse and (with approval) migrate production.

## Update 2026-11-18 (images merged)

The owner uploaded 27 optimized WebP images to `main` (commit `08c286f`); they were merged into PR #4 without conflicts. The homepage now carries a multi-campaign hero carousel, image-led campaign cards and photo-only favourites; the gallery heading no longer claims Instagram or shows demo labels with the official catalog. Run `npm run assets:check` and `npm run test:storefront` after changing images or campaigns. Still pending: the official logo and the three BATCH-06 images.

## Update 2026-11-18 (business profile, fiscal settings, receipts)

Branch `feat/business-profile-fiscal`. Added the persisted business profile (`business_profile`), fiscal settings (`fiscal_settings`) and their ADMIN screen, a checkout readiness gate with explicit blockers, per-order GST/QST breakdown and business snapshot (migration 008), customer receipts, structured data and pickup instructions from the profile, and an idempotent one-time initialiser (`npm run business:init`). Pickup lead time and capacity are now optional and unset until decided. Findings that need the owner: no prices exist anywhere, the opening hours are unverified and conflict with one source, the phone could not be found publicly, and Revenu Québec billing rules (including a certified sales recording system) need the accountant. Details: [Business profile](BUSINESS_PROFILE.md), [Tax](TAX.md).

## Update 2026-11-19 (free-drink stamp card)

The loyalty program is now the 9 + 1 stamp card (migration 010, `src/stamp-progress.tsx`); see [Rewards](REWARDS.md) and the decision of the same date. Next steps: run `npm run db:migrate` on each database (it aborts if real balances exist under an authorized program), run the browser smoke scripts `npm run test:rewards` and `npm run test:rewards-public` on a disposable PostgreSQL fixture (updated for stamps but **not executed** in the session that wrote them), generate the BATCH-07 stamp artwork, and get the owner's decisions on eligible drinks, free-drink value cap, per-order cap, promotion stacking and expiry before activation.

## Update 2026-11-18 (Salut Rewards 5 % and public page)

Branch `claude/salut-rewards-implementation-xy2gra` (from `main` at c5f249d; no open PRs or unmerged work existed). Added migration 009, public `/fr/recompenses` + `/en/rewards`, guest card (`/fr/recompenses/carte`, `/en/rewards/card`), refund reversal, five program states in ADMIN, cart/product points hints, header/footer/home integration, localized SEO, the French commercial proposal, and tests. Preserved: the ledger, QR engine, staff/admin flows, checkout, tax and payment code. Start with [Rewards](REWARDS.md) and [Launch readiness](LAUNCH_READINESS.md). Before any activation: rehearse migration 009 on a Neon test branch, owner decisions in the proposal, then the ADMIN authorization. Do not enable rewards in production without it.

## Update 2026-11-19 (admin access, team management, rehearsal accounts)

Branch `claude/sharp-volta-qnyknv`. Added `/admin/team` (ADMIN creates, promotes, demotes, resets and removes STAFF/ADMIN accounts with last-admin protection and audit), an ordering-readiness summary on the Admin home, and `SALUT_INSTANT_ACCOUNTS=1` (customer sign-up without email; the owner enabled it in Production on 2026-11-19 — remove it once Resend is configured). Guide: [Admin access](ADMIN_ACCESS.md). Production now has `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `SITE_URL` and `SALUT_INSTANT_ACCOUNTS=1`, and one ADMIN user created directly in the production Neon database (its initial password was shared in chat: change it).
