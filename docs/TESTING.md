# Testing

- `npm run check` generates route types, checks strict TypeScript and runs ESLint.
- `npm test` verifies pricing, modifier validation, concurrent order retries, private lookup, state transitions, payment guards and stale pickups against ephemeral PGlite.
- `npm run build` builds the optimized app.
- `npm run test:browser` drives the built app through mobile locale switching, carousel, customization, cart reload, pickup checkout, private tracking, failed and successful staff login and fulfillment. Start the app at port 3100 with an isolated writable `SALUT_DATA_DIR` and local demo credentials. Set `CHROMIUM_PATH` for a different browser binary or `SMOKE_BASE_URL` to use a different origin. Opt in to writing the generated synthetic receipt URL by setting `SMOKE_RECEIPT_FILE`. To verify a restart, run the browser command with that synthetic URL as its argument after restarting with the same data directory.

Neon connectivity, multitenant authorization, payment webhooks, notifications, loyalty and analytics lack test coverage. Manual QA remains for a full keyboard pass, screen-reader behavior and verified business content.

## Latest results

In the cloud checkout, `npm run check` passed without warnings, `npm test` passed all four tests, and `npm run build` succeeded. The Chromium smoke passed against `next start`; a separate browser check confirmed the completed synthetic order remained available after restarting on the same data directory. The final production dependency audit reported zero known vulnerabilities.

## Staff authorization verification

After applying migrations 001 and 002 to a disposable database, run the built app with its Better Auth configuration. Set `STAFF_SMOKE_DATABASE_URL` and `STAFF_SMOKE_BASE_URL` to that database and app, then run `npm run test:staff`. The test provisions synthetic STAFF, ADMIN and CUSTOMER fixtures, creates an order, and removes those fixtures at the end.

Latest cloud run passed type checking, linting, all four order tests, the production build and the existing full demo browser smoke. The staff browser smoke passed against both migrations on a temporary PGlite PostgreSQL wire-protocol endpoint using the app's pg driver. It covered guest denial, CUSTOMER sign-in denial, STAFF and ADMIN transitions, denial of a mutation after ADMIN demotion, and sign-out. Live Neon and Vercel validation are pending.

A separate startup check confirmed that configuring PostgreSQL without the Better Auth settings disables staff sign-in and hides the demo password. The production dependency audit flagged the picomatch advisory GHSA-fc5q-39xc-vjpf through Better Auth's optional Vitest peer. The current registry's latest picomatch version is within the advisory range, and npm proposed a major Vitest downgrade. No forced downgrade was applied.

## Approved storefront redesign

Type checking, ESLint, all four order tests and a production build passed. The updated browser smoke covered both rewards names, campaign navigation, the matcha category deep link, the live cart badge, cart persistence, checkout and order fulfillment. The separate Better Auth staff browser smoke passed. Both locale homepages passed viewport and navigation overflow checks at 320, 390, 768, 1024 and 1440 pixels. Desktop and phone screenshots were compared with the approved mockup using placeholder artwork. The 15 wired media paths match the manifest and all three prompt batches. Rerun image crop review after the approved media is installed.

## Commercial milestone

TypeScript, ESLint, all four existing order tests, the production build and the original demo browser smoke passed. A fresh local PGlite PostgreSQL-wire fixture applied migrations 001 through 004, imported the official catalog, and accepted a repeat import through pg. The staff browser smoke passed against the fixture with ADMIN page access and guest/STAFF denial. The new catalog browser smoke verified campaign navigation, mobile overflow, unpriced product details, a required modifier, local cart persistence, refreshed pricing and explicit reconfirmation, bilingual stored snapshots, and private tracking.

Use `node scripts/import-catalog.mjs --verify-local` for the disposable import check. On a fresh local fixture with all migrations and the catalog imported, set `CATALOG_SMOKE_DATABASE_URL` and `CATALOG_SMOKE_BASE_URL`, then run `node tests/catalog-browser-smoke.mjs`. This test writes synthetic prices, assignments and orders. Discard the fixture after the test. Add `STAFF_SMOKE_CATALOG=1` to the staff smoke on that fixture to verify the pricing page.

`npm audit --omit=dev` continues to report GHSA-fc5q-39xc-vjpf via Vitest and its dependency tree. npm offered a major downgrade with `--force`. Dependency versions were preserved. Review a supported dependency update before launch.

The expanded suite includes Montréal pickup policy and tax tests plus synthetic Stripe webhook verification and a demo email guard. Run the catalog browser smoke with `CATALOG_SMOKE_ANALYTICS=1` against an app configured with `SALUT_ANALYTICS_ENABLED=1` to verify initial opt-out and campaign attribution to an accepted order. The staff smoke can verify ADMIN catalog edits and rejection after a role change. Provider network calls and hosted Neon remain unverified.

## Running the full suite (2026-11-18)

```bash
npm run check                       # types + lint
TEST_DATABASE_URL=postgresql://… npm test   # unit tests; the 7 real-PostgreSQL tests run when this is set
npm run build
```

`TEST_DATABASE_URL` must point at a **disposable** PostgreSQL migrated with `node scripts/migrate.mjs` and imported with `node scripts/import-catalog.mjs` (CI provides one as a service container). Without it the concurrency suites (`tests/loyalty-concurrency.test.ts`, `tests/pickup-capacity.test.ts`) are skipped.

Browser suites (need a built app and a Chromium path in `CHROMIUM_PATH`). `npm run test:storefront` (needs only a running official-catalog app and `SMOKE_BASE_URL`) audits images, campaign links, accessibility structure and placeholder copy on 14 pages at desktop and mobile widths.

| Suite | Command | Needs |
| --- | --- | --- |
| Demo storefront | `npm run test:browser` | App without `DATABASE_URL` on port 3100. |
| Catalog | `node tests/catalog-browser-smoke.mjs` | `CATALOG_SMOKE_DATABASE_URL`, `CATALOG_SMOKE_BASE_URL`. |
| Staff authorization | `npm run test:staff` | `STAFF_SMOKE_DATABASE_URL`, `STAFF_SMOKE_BASE_URL`. |
| Rewards, accounts, hours, menu | `npm run test:rewards` | `E2E_DATABASE_URL`, `E2E_MAIL_DIR`, optional `SMOKE_BASE_URL`; database with ADMIN `admin@example.invalid` / `AdminPassw0rd!x` and STAFF `staff@example.invalid` / `StaffPassw0rd!x` created with `npm run staff:create`; app started with `SALUT_EMAIL_CAPTURE_DIR` (non-deployed only, writes account emails to files instead of sending), `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET` and `SITE_URL` on the same localhost origin. Reset the database between runs. |

The rewards suite was also run with the app connected as the least-privilege `salut_app` role. Run tests only against disposable local or CI databases, never `production`.

## Salut Rewards 5 % tests (2026-11-18)

- `npm test`: adds `tests/rewards-five-percent.test.ts`, `tests/rewards-public.test.tsx` (renders the public pages against an in-memory database), `tests/rewards-permissions.test.ts` and extra cases in `tests/loyalty-concurrency.test.ts`. `vitest.config.mts` only enables the automatic JSX runtime for the page test.
- `npm run test:rewards-public`: browser checks at 390 px and 1280 px in FR and EN (no login, no overflow, images, calculator, preview vs active states, metadata, guest card, STAFF counter flow, cart hint, ADMIN state panel). Run it **after** `npm run test:rewards` on the same fixture (it needs ADMIN/STAFF, the catalog and, for the guest-order step, an open checkout); set `E2E_DATABASE_URL`, `SMOKE_BASE_URL`, `CHROMIUM_PATH`, optionally `SHOT_DIR` for screenshots. Build with `SITE_URL` set to the test origin so canonical, alternates, `robots.txt` and the sitemap can be asserted.
- Run only on disposable databases. Results: see [Launch readiness](LAUNCH_READINESS.md).
