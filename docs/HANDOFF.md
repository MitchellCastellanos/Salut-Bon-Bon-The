# Handoff

## Current checkpoint

Branch `feat/salut-plus-foundation`. Verified implementation commit `2d2d05180d9f0b7ea52754176d94354f04d776ca`.

The credential-free demo runs the first guest pickup workflow end to end. See [implementation status](IMPLEMENTATION_STATUS.md) for remaining Salut Plus areas and [testing](TESTING.md) for verification. The local PostgreSQL migration is `db/001-orders.sql`; it initializes automatically in PGlite. Neon migration rehearsal is pending. Demo checkout and staff sign-in work without external credentials. No real payment or notification provider is connected.

## Next priority

Prepare the Neon-backed foundation and enforce individual STAFF and ADMIN roles. Start with `src/db.ts`, `db/001-orders.sql`, `src/staff.ts`, `app/[lang]/staff/actions.ts` and `tests/orders.test.ts`. Preserve order migration 001 and the guest flow. Rehearse against an isolated Neon branch when available. Queue admin settings next so ordering enforces store hours, pause and capacity before a public pilot. The owner needs to confirm store hours, taxes, catalog and official assets.

## Commands and continuation

Run `npm ci`, `npm run dev`, `npm run check`, `npm test`, and `npm run build`. See [testing](TESTING.md) for the browser command. Read [decisions](DECISIONS.md) before changing persistence or authentication. Keep the existing checkout and do not push to main. Use `git status -sb` and `git log -2 --oneline` for the live checkout state.

## Ready-to-paste agent prompt

> Read AGENTS.md, docs/HANDOFF.md, docs/IMPLEMENTATION_STATUS.md and docs/IMPLEMENTATION_PLAN.md. Implement the Better Auth staff foundation with a PostgreSQL migration, individual staff accounts and server role checks across the staff page and order mutations. Keep the credential-free demo isolated, fail closed for Neon when auth is unconfigured, preserve checkout and tracking, and exercise authorization with guest, staff and administrator test users. Run typecheck, lint, tests, build and the existing browser smoke. Record exact migration and test outcomes, then update status, decisions, changelog and handoff.
