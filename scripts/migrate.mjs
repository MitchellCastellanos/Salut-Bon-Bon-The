// Ordered, ledgered, transactional migration runner.
// Usage: MIGRATION_DATABASE_URL=<owner role, direct host> node scripts/migrate.mjs [--dry-run] [--status] [--baseline=NNN]
// Each db/NNN-*.sql file runs once, inside one transaction, under an advisory lock. Applied files are
// checksummed; a changed applied file aborts the run. Never executed automatically at request or build time.
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import pg from "pg";

const args = process.argv.slice(2);
const dry = args.includes("--dry-run");
const statusOnly = args.includes("--status");
const baseline = args.find(a => a.startsWith("--baseline="))?.split("=")[1];
const url = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("Set MIGRATION_DATABASE_URL (owner role, direct host) for the target branch");

const dir = new URL("../db/", import.meta.url);
const files = (await readdir(dir)).filter(f => /^\d{3}-.+\.sql$/.test(f)).sort();
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
  await client.query("SELECT pg_advisory_lock(7251964)");
  const { rows } = await client.query("SELECT id, checksum FROM schema_migrations");
  const applied = new Map(rows.map(r => [r.id, r.checksum]));
  if (!applied.size) {
    const { rows: [t] } = await client.query("SELECT to_regclass('public.orders') IS NOT NULL AS legacy");
    if (t.legacy && !baseline) throw new Error("Schema exists without a ledger. Verify it, then re-run with --baseline=<last applied NNN>.");
  }
  for (const file of files) {
    const id = file.replace(/\.sql$/, "");
    const sql = await readFile(new URL(file, dir), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    if (applied.has(id)) {
      if (applied.get(id) !== checksum) throw new Error(`${id} changed after being applied`);
      console.log(`ok       ${id}`);
      continue;
    }
    if (baseline && file.slice(0, 3) <= baseline) {
      await client.query("INSERT INTO schema_migrations (id, checksum) VALUES ($1, $2)", [id, checksum]);
      console.log(`baseline ${id}`);
      continue;
    }
    if (statusOnly || dry) { console.log(`pending  ${id}`); continue; }
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (id, checksum) VALUES ($1, $2)", [id, checksum]);
      await client.query("COMMIT");
      console.log(`applied  ${id}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw new Error(`${id} failed and was rolled back: ${error.message}`);
    }
  }
} finally {
  await client.query("SELECT pg_advisory_unlock(7251964)").catch(() => {});
  await client.end();
}
