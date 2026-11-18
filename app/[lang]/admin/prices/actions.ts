"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { database } from "../../../../src/db";
import { language } from "../../../../src/domain";
import { staffActor, staffRole } from "../../../../src/staff";

const dollars = z.union([z.literal(""), z.string().regex(/^\d{1,3}(\.\d{1,2})?$/)]);

/**
 * Saves every price on the sheet at once. A price is only live when the owner ticks the approval box:
 * blank means "not sold in this size", never an invented price.
 */
export async function savePriceSheet(lang: string, form: FormData) {
  if (!process.env.DATABASE_URL || await staffRole() !== "ADMIN") throw new Error("Forbidden");
  if (!language(lang)) return;
  const fail = (code: string): never => redirect(`/${lang}/admin/prices?error=${code}`);
  if (form.get("confirm") !== "on") fail("confirm");
  const db = await database();
  const { rows: products } = await db.query<{ id: string }>("SELECT id FROM catalog_products");
  const rows: { id: string; size: "regular" | "large"; cents: number | null }[] = [];
  const available: Record<string, boolean> = {};
  for (const { id } of products) {
    available[id] = form.get(`avail_${id}`) === "on";
    for (const size of ["regular", "large"] as const) {
      const parsed = dollars.safeParse(String(form.get(`price_${id}_${size}`) ?? ""));
      if (!parsed.success) fail("price");
      const value = parsed.data!;
      const cents = value === "" ? null : Math.round(Number(value) * 100);
      if (cents !== null && (cents < 1 || cents > 100000)) fail("price");
      rows.push({ id, size, cents });
    }
  }
  const actor = await staffActor();
  await db.query(`
    WITH incoming AS (SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(id text, size text, cents int, available boolean)),
    priced AS (
      INSERT INTO catalog_variants (product_id, id, fr, en, price_cents, approved, available)
      SELECT id, size, CASE WHEN size = 'regular' THEN 'Régulier' ELSE 'Grand' END, CASE WHEN size = 'regular' THEN 'Regular' ELSE 'Large' END, cents, true, available
      FROM incoming WHERE cents IS NOT NULL
      ON CONFLICT (product_id, id) DO UPDATE SET price_cents = EXCLUDED.price_cents, approved = true, available = EXCLUDED.available,
        promotional_cents = CASE WHEN catalog_variants.promotional_cents < EXCLUDED.price_cents THEN catalog_variants.promotional_cents END
      RETURNING product_id, id, price_cents
    ), unsold AS (
      UPDATE catalog_variants v SET approved = false, available = false FROM incoming i
      WHERE i.cents IS NULL AND v.product_id = i.id AND v.id = i.size RETURNING v.product_id, v.id
    ), products AS (
      UPDATE catalog_products p SET available = (i.available) FROM (SELECT DISTINCT id, available FROM incoming) i WHERE p.id = i.id AND p.available <> i.available RETURNING p.id, p.available
    )
    INSERT INTO catalog_audit_history (action, subject, details)
    SELECT 'pricing.sheet', product_id || ':' || id, jsonb_build_object('price_cents', price_cents, 'actor', $2::text) FROM priced
  `, [JSON.stringify(rows.map(r => ({ ...r, available: available[r.id] }))), actor]);
  revalidatePath("/[lang]", "layout");
  redirect(`/${lang}/admin/prices?saved=1`);
}
