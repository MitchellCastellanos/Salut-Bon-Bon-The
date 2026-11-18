import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";

type Row = Record<string, unknown>;
type Database = { query<T extends Row>(sql: string, args?: unknown[]): Promise<{ rows: T[] }> };
const cached = globalThis as typeof globalThis & { salutDatabase?: Promise<Database> };

async function connect(): Promise<Database> {
  if (process.env.DATABASE_URL) return new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  const local = new PGlite(process.env.SALUT_DATA_DIR || join(process.cwd(), ".salut-data"));
  await local.exec(await readFile(join(process.cwd(), "db/001-orders.sql"), "utf8"));
  return local;
}
export function database() {
  cached.salutDatabase ??= connect().catch(error => {
    delete cached.salutDatabase;
    throw error;
  });
  return cached.salutDatabase;
}
