import { database } from "./db";

type Db = { query<T extends Record<string, unknown>>(sql: string, args?: unknown[]): Promise<{ rows: T[] }> };

export async function isFavorite(userId: string, productId: string, db?: Db) {
  return Boolean((await (db ?? await database()).query("SELECT 1 FROM customer_favorites WHERE user_id = $1 AND product_id = $2", [userId, productId])).rows.length);
}
export async function favoriteProducts(userId: string, db?: Db) {
  return (await (db ?? await database()).query<{ product_id: string; fr: string; en: string }>(`
    SELECT f.product_id, max(t.name) FILTER (WHERE t.locale = 'fr') AS fr, max(t.name) FILTER (WHERE t.locale = 'en') AS en
    FROM customer_favorites f JOIN catalog_product_translations t ON t.product_id = f.product_id
    WHERE f.user_id = $1 GROUP BY f.product_id, f.created_at ORDER BY f.created_at DESC LIMIT 50`, [userId])).rows;
}
/** Adds or removes a favorite; only existing products can be saved. Returns the new state. */
export async function toggleFavorite(userId: string, productId: string, db?: Db) {
  const connection = db ?? await database();
  const removed = await connection.query("DELETE FROM customer_favorites WHERE user_id = $1 AND product_id = $2 RETURNING product_id", [userId, productId]);
  if (removed.rows.length) return false;
  const added = await connection.query("INSERT INTO customer_favorites (user_id, product_id) SELECT $1, id FROM catalog_products WHERE id = $2 ON CONFLICT DO NOTHING RETURNING product_id", [userId, productId]);
  return added.rows.length > 0;
}
