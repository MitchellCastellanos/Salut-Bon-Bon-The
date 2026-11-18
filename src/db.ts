import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";

type Row = Record<string, unknown>;
type Database = { query<T extends Row>(sql: string, args?: unknown[]): Promise<{ rows: T[] }> };
const cached = globalThis as typeof globalThis & { salutDatabase?: Promise<Database>; salutPostgresPool?: Pool };

export function postgresPool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  return cached.salutPostgresPool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
}

/** Applies db/NNN-*.sql once each, in order, recording them in the same ledger the Postgres runner uses. */
export async function applyLocalMigrations(local: PGlite, directory = join(process.cwd(), "db")) {
  await local.exec("CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())");
  const done = new Set((await local.query<{ id: string }>("SELECT id FROM schema_migrations")).rows.map(row => row.id));
  for (const file of (await readdir(directory)).filter(name => /^\d{3}-.+\.sql$/.test(name)).sort()) {
    const id = file.replace(/\.sql$/, "");
    if (done.has(id)) continue;
    await local.exec(`BEGIN;\n${await readFile(join(directory, file), "utf8")}\n;INSERT INTO schema_migrations (id, checksum) VALUES ('${id}', 'local');\nCOMMIT;`);
  }
}

/** Deployed environments must use PostgreSQL. The embedded demo database is for local development only. */
export function demoStorageAllowed() {
  return process.env.VERCEL_ENV !== "production" && process.env.VERCEL_ENV !== "preview" || process.env.SALUT_ALLOW_DEMO === "1";
}

async function connect(): Promise<Database> {
  if (process.env.DATABASE_URL) return postgresPool();
  if (!demoStorageAllowed()) throw new Error("DATABASE_URL is required in deployed environments");
  const local = new PGlite(process.env.SALUT_DATA_DIR || join(process.cwd(), ".salut-data"));
  await applyLocalMigrations(local);
  return local;
}
export function database() {
  cached.salutDatabase ??= connect().catch(error => {
    delete cached.salutDatabase;
    throw error;
  });
  return cached.salutDatabase;
}
