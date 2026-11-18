# Handoff

## Current checkpoint

Branch `feat/salut-plus-foundation`. The first guest pickup workflow remains verified in the private local demo. Staff can also sign in with individual PostgreSQL-backed Better Auth accounts. STAFF and ADMIN can read and update the order queue. Current role checks deny guests, CUSTOMER accounts and demoted sessions. Admin-only management screens are pending. See [status](IMPLEMENTATION_STATUS.md) and [testing](TESTING.md).

The [image manifest](IMAGE_ASSET_MANIFEST.md) lists five wired concept-image slots in generation order. The promotion path is reserved. The logo and storefront photo require owner-supplied files.

## Database and configuration

`db/001-orders.sql` initializes automatically in the local demo. A configured PostgreSQL database needs 001 followed by `db/002-staff-auth.sql`, `DATABASE_URL`, `BETTER_AUTH_URL` and `BETTER_AUTH_SECRET`. Use `npm run staff:create` as documented in [environment setup](ENVIRONMENT_SETUP.md). Both migrations and the sign-in flow ran against a temporary local database using the PostgreSQL wire protocol. Neon rehearsal still needs an authorized test branch. No external payment or notification provider is connected.

## Next priority

Add admin-only store settings and enforce pickup availability during order creation. Start with `src/auth.ts`, `src/staff.ts`, `src/orders.ts`, `src/domain.ts` and `app/[lang]/menu/actions.ts`. Confirm store hours, pause behavior and capacity with the owner. Preserve guest checkout and tracking. Keep the database authoritative for capacity when orders race or retry. Add login and checkout rate limiting before a public pilot.

## Commands and continuation

Use `npm ci`, `npm run dev`, `npm run check`, `npm test` and `npm run build`. See [testing](TESTING.md) for both browser commands. Read [decisions](DECISIONS.md) before changing persistence or authentication.

## Ready-to-paste agent prompt

> Read AGENTS.md, docs/HANDOFF.md, docs/IMPLEMENTATION_STATUS.md and docs/IMPLEMENTATION_PLAN.md. Add versioned PostgreSQL store settings and an ADMIN-only editor for ordering pause, hours, lead time and per-slot capacity. Enforce those settings in server-generated slots and atomically during checkout. Preserve retry idempotency and the credential-free demo. Use an isolated Neon branch to rehearse migrations when access is available. Exercise guest checkout, concurrent slot limits, STAFF denial and ADMIN access. Run type checking, lint, tests, build and both browser smokes. Update the schema, decisions, status, changelog and handoff.
