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
