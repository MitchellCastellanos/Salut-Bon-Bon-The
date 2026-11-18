// One-time, idempotent initialisation of the business profile (and optionally the weekly schedule).
//
//   node scripts/init-business.mjs --print-sql            print the statements (no database needed)
//   MIGRATION_DATABASE_URL=… node scripts/init-business.mjs [--with-hours]
//
// Safe to run repeatedly: every write is INSERT … ON CONFLICT DO NOTHING, so existing values are never overwritten, and an audit
// row is written only when something was actually inserted. It never touches prices, fiscal settings or the pickup switch.
// Hours are only written with --with-hours, and only if no pickup policy exists yet; lead time and capacity are never set.
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { profileSchema } from "../src/business-core.ts";
import { pickupPolicySchema } from "../src/pickup-policy.ts";

export function buildStatements(seed, { withHours = false } = {}) {
  const profile = profileSchema.parse(seed.profile);
  const statements = [{
    sql: `WITH ins AS (INSERT INTO catalog_store_settings (key, value) VALUES ('business_profile', $1::jsonb) ON CONFLICT (key) DO NOTHING RETURNING key, value)
          INSERT INTO catalog_audit_history (action, subject, details) SELECT 'business.init', key, jsonb_build_object('value', value, 'actor', 'init-business') FROM ins`,
    params: [JSON.stringify(profile)],
  }];
  if (withHours) {
    const policy = pickupPolicySchema.parse({ hours: seed.weeklyHours });
    statements.push({
      sql: `WITH ins AS (INSERT INTO catalog_store_settings (key, value) VALUES ('pickup_policy', $1::jsonb) ON CONFLICT (key) DO NOTHING RETURNING key, value)
            INSERT INTO catalog_audit_history (action, subject, details) SELECT 'business.init', key, jsonb_build_object('value', value, 'actor', 'init-business') FROM ins`,
      params: [JSON.stringify(policy)],
    });
  }
  return statements;
}

async function main() {
  const seed = JSON.parse(await readFile(new URL("../db/seeds/business-initial.json", import.meta.url), "utf8"));
  const withHours = process.argv.includes("--with-hours");
  const statements = buildStatements(seed, { withHours });
  if (process.argv.includes("--print-sql")) {
    for (const { sql, params } of statements) console.log(sql.replace(/\s+/g, " ").trim().replace("$1", `'${params[0].replace(/'/g, "''")}'`) + ";");
    return;
  }
  const url = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("Set MIGRATION_DATABASE_URL, or use --print-sql");
  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    for (const { sql, params } of statements) await client.query(sql, params);
    const { rows } = await client.query("SELECT key FROM catalog_store_settings WHERE key IN ('business_profile', 'pickup_policy') ORDER BY key");
    console.log(`Initialisation complete. Present: ${rows.map(row => row.key).join(", ") || "nothing"}.`);
  } finally { await client.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
