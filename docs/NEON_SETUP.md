# Neon setup

Verified 2026-11-18 through the Neon MCP tools. No credentials appear in this repository.

## Project

| Item | Value |
| --- | --- |
| Project | `salut-bon-bon-the` (`blue-night-63975243`), org `org-blue-union-70501359` |
| Region | `aws-us-east-1` (N. Virginia). Neon offers no Canadian region; this is the closest to Montréal. |
| Postgres | 17, database `salut` |
| Other projects in the account (`pichijourney`, `redwood-growth`, `GarageOS`) | Not touched. |

## Branches

| Branch | ID | Purpose | State |
| --- | --- | --- | --- |
| `production` (default) | `br-round-mud-bcvgh3ji` | Live data. | **Empty. Nothing applied. Awaiting owner approval.** |
| `development` | `br-winter-wildflower-bcrow60v` | Preview deployments and QA. | Migrations 001–007 (ledger has 7 rows), official catalog, `salut_app` role. |
| `migration-test` | `br-rapid-leaf-bcsipgsm` | Disposable rehearsal. Reset from `production` before each rehearsal. | Migrations 001–007, catalog import. |

## Roles

- `salut_owner`: DDL and migrations only. Use the **direct** (non-pooled) host. Never configure it on Vercel runtime.
- `salut_app`: runtime. `SELECT/INSERT/UPDATE/DELETE` on catalog and marketing tables; **no DELETE** on `orders`, `order_events`, `payment_attempts`, `provider_events`, `email_outbox`, `catalog_audit_history` and the loyalty history tables; **no UPDATE or DELETE** on append-only history (`loyalty_transactions`, `order_events`, `catalog_audit_history`, `provider_events`, enforced by migration 007); no DDL; no access to `schema_migrations`. Use the **pooled** host. Roles are per branch: create `salut_app` on `production` with its own password before the first deploy.

## Migrations

`scripts/migrate.mjs` applies `db/NNN-*.sql` in order, each in one transaction, under an advisory lock, recording `schema_migrations(id, checksum)`. A changed applied file aborts. Never run from the app, at build, or per request.

```bash
MIGRATION_DATABASE_URL=<owner, direct host> npm run db:status   # shows pending
MIGRATION_DATABASE_URL=<owner, direct host> npm run db:migrate
MIGRATION_DATABASE_URL=<owner, direct host> node scripts/import-catalog.mjs   # idempotent
```

For a database that already has the schema but no ledger: `--baseline=NNN` records files up to NNN without running them, after you verify the schema.

### Rehearsal evidence (migration-test, then development)

- 001–005 applied; ledger holds 5 rows with the file checksums.
- Forced failure inside a transaction left no ledger row and no column (rollback verified).
- 19 foreign keys, 39 indexes after 001–004.
- Catalog import: 62 products (52 coded, 5 mango, 4 crème brûlée, 1 uncoded pineapple), 124 translations, 18 modifiers, 7 categories, 4 collections/campaigns, 15 collection members, 5 featured, 9 images, 8 campaign translations.
- Re-running the import in the same transaction left every count unchanged.
- Payment reconciliation SQL executed as `salut_app` on development: first event settles, replay inserts nothing. Synthetic rows were removed afterwards.

### Migrations 006 and 007 (accounts, loyalty, append-only history)

Applied to `migration-test` first, verified, then applied to `development`. Neon-side verification with real SQL on `migration-test`: fund 100 → redeem 30 gives 70; replaying the same key is a duplicate no-op; a used token, an unknown token, an expired token, an unavailable reward, an insufficient balance and an inactive program are each refused with `QR_USED`, `QR_INVALID`, `QR_EXPIRED`, `REWARD_UNAVAILABLE`, `INSUFFICIENT_POINTS` and `PROGRAM_INACTIVE`; test rows were removed. Verifying `development` after 006 found that the runtime role could still UPDATE `loyalty_transactions` (Neon's default privileges grant UPDATE on new tables), which led to migration 007; after it, `salut_app` has INSERT but not UPDATE or DELETE on the history tables, and a trigger rejects any change to loyalty history. `production` was **not** touched.

> The agent sandbox cannot open direct TCP connections to Neon, so the Neon steps were executed with the Neon `run_sql` tools using the same SQL and checksums. `scripts/migrate.mjs` itself was verified against a real local PostgreSQL 16 (all seven files applied, repeat run reports `ok`, catalog import idempotent) and runs unchanged in CI. Run `npm run db:status` from a networked machine once to confirm the Neon ledger reports all seven as `ok`.

## Recovery

- Neon keeps 6 hours of point-in-time history on this project (`history_retention_seconds` = 21600). Raise it before launch if the plan allows.
- Before every production migration: create a Neon branch (or snapshot) from `production`, run the migration on that branch first, and keep it until the release is verified.
- Rollback = restore the branch to the pre-migration timestamp (Neon console: Restore) or point `DATABASE_URL` at the pre-migration branch. Migrations here are additive; destructive down-migrations are intentionally not provided.

## Production deployment procedure (requires owner approval)

1. Confirm `development` verification is current and CI is green on the release commit.
2. Create `pre-release-YYYYMMDD` branch from `production`.
3. Create `salut_app` on `production`; save the pooled URL as `DATABASE_URL` in Vercel Production only.
4. Run `db:status`, then `db:migrate`, then `import-catalog.mjs` against `production` with the owner role.
5. Create ADMIN users with `npm run staff:create` (password via stdin).
6. Enter owner-approved prices, hours, capacity and tax settings in `/admin`. Leave `pickup_checkout_enabled` off.
7. Deploy, smoke-test, then enable checkout only after the readiness gates in `LAUNCH_READINESS.md` pass.
