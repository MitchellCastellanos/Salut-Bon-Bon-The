import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const verify = process.argv[2] === "--verify-local";
if (!verify && !(process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL)) throw new Error("Set DATABASE_URL to the isolated target branch");
const db = verify ? new PGlite() : new pg.Client({ connectionString: (process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL) });
try {
  if (verify) await db.exec(await read("db/003-catalog.sql"));
  else await db.connect();
  const sql = await read("db/import-catalog.sql");
  const source = await read("catalog/official.json");
  await db.query(sql, [source]);
  if (verify) await db.query(sql, [source]);
  const { rows: [counts] } = await db.query(`
    SELECT
      (SELECT count(*)::int FROM catalog_products) AS products,
      (SELECT count(code)::int FROM catalog_products) AS coded,
      (SELECT count(*)::int FROM catalog_products WHERE category = 'fresh-mango-series') AS mango,
      (SELECT count(*)::int FROM catalog_products WHERE category = 'creme-brulee') AS brulee,
      (SELECT count(*)::int FROM catalog_products WHERE id = 'pineapple-lemonade' AND code IS NULL) AS pineapple,
      (SELECT count(*)::int FROM catalog_product_translations) AS translations,
      (SELECT count(*)::int FROM catalog_modifiers) AS modifiers,
      (SELECT count(*)::int FROM catalog_collection_products WHERE collection_id = 'house-lemonade') AS poster
  `);
  console.log(counts);
  if (verify && Object.entries({ products: 62, coded: 52, mango: 5, brulee: 4, pineapple: 1, translations: 124, modifiers: 18, poster: 6 }).some(([key, value]) => counts[key] !== value)) {
    throw new Error("Official catalog counts do not match the source inventory");
  }
} finally {
  if (verify) await db.close();
  else await db.end();
}
