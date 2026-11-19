import "server-only";
import { database } from "./db";
import source from "../catalog/official.json";

type Price = { id: string; size: "regular" | "large"; cents: number };
const base: Record<string, number> = {
  "milk-tea": 599, "fruit-tea": 599, smoothies: 799, lemonade: 599,
  matcha: 675, "fresh-mango-series": 799, "creme-brulee": 899,
};

/** Customer-facing price display; distinct from authorized real checkout pricing. */
export async function displayedCatalogPrices(): Promise<Price[]> {
  if (!process.env.DATABASE_URL) return source.products.flatMap(product => [
    { id: product.id, size: "regular" as const, cents: base[product.category] ?? 595 },
    { id: product.id, size: "large" as const, cents: (base[product.category] ?? 595) + 100 },
  ]);
  const { rows } = await (await database()).query<Price>(`
    SELECT product_id AS id, id AS size,
      coalesce(promotional_cents,price_cents) AS cents
    FROM catalog_variants
    WHERE id IN ('regular','large') AND price_cents > 0
    ORDER BY product_id,id
  `);
  return rows;
}
