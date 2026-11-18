# Neon setup

The current session did not expose Neon tools or a Neon database binding. Project ID, region and remote branch names remain unverified. Inspect the account before creating `salut-bon-bon-the`. Prefer a supported Canadian region and otherwise select a North American region. Keep production, development and disposable migration-testing branches separate.

Apply `db/001-orders.sql`, `db/002-staff-auth.sql`, and `db/003-catalog.sql` in order to a fresh disposable branch. For existing databases inspect migration history first. Apply migration 002 only once. Before merging database changes to development, run the import twice, verify the counts and run browser checks against that branch. Keep production isolated from synthetic orders and staff fixtures. Supply connection strings securely through deployment configuration.
