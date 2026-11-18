"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { database } from "../../../src/db";
import { staffRole } from "../../../src/staff";

const entry = z.object({
  id: z.string().regex(/^[a-zA-Z0-9-]{1,64}$/),
  size: z.enum(["regular", "large"]),
  price: z.number().int().positive().max(100000),
  promo: z.number().int().positive().max(100000).nullable(),
  approved: z.boolean(),
  available: z.boolean(),
}).refine(row => row.promo === null || row.promo < row.price);

export async function savePricing(form: FormData) {
  if (!process.env.DATABASE_URL || await staffRole() !== "ADMIN") throw new Error("Forbidden");
  const key = form.get("id");
  const cents = (key: string) => {
    const value = form.get(key);
    return typeof value === "string" && /^\d{1,6}$/.test(value) ? Number(value) : NaN;
  };
  const row = entry.parse({
    id: key,
    size: form.get("size"),
    price: cents("price"),
    promo: form.get("promo") === "" ? null : cents("promo"),
    approved: form.get("approved") === "on",
    available: form.get("available") === "on",
  });
  await storePricing([row]);
}

export async function saveBulkPricing(form: FormData) {
  if (!process.env.DATABASE_URL || await staffRole() !== "ADMIN") throw new Error("Forbidden");
  const input = z.string().max(32000).parse(form.get("prices"));
  const rows = z.array(entry).min(1).max(124).parse(JSON.parse(input));
  if (new Set(rows.map(row => `${row.id}:${row.size}`)).size !== rows.length) throw new Error("Duplicate variant");
  await storePricing(rows);
}

async function storePricing(rows: z.infer<typeof entry>[]) {
  await (await database()).query(`
    WITH saved AS (
      INSERT INTO catalog_variants (product_id, id, fr, en, price_cents, promotional_cents, approved, available)
      SELECT id, size, CASE WHEN size = 'regular' THEN 'Régulier' ELSE 'Grand' END,
             CASE WHEN size = 'regular' THEN 'Regular' ELSE 'Large' END, price, promo, approved, available
      FROM jsonb_to_recordset($1::jsonb) AS incoming(id text, size text, price int, promo int, approved boolean, available boolean)
      ON CONFLICT (product_id, id) DO UPDATE SET price_cents = excluded.price_cents,
        promotional_cents = excluded.promotional_cents, approved = excluded.approved, available = excluded.available
      RETURNING *
    )
    INSERT INTO catalog_audit_history (action, subject, details)
    SELECT 'pricing.update', product_id, to_jsonb(saved) FROM saved
  `, [JSON.stringify(rows)]);
  revalidatePath("/[lang]/admin", "page");
  revalidatePath("/[lang]/catalog", "page");
}

export async function saveAvailability(form: FormData) {
  if (!process.env.DATABASE_URL || await staffRole() !== "ADMIN") throw new Error("Forbidden");
  const id = z.string().regex(/^[a-zA-Z0-9-]{1,64}$/).parse(form.get("id"));
  const available = form.get("available") === "on";
  await (await database()).query(`
    WITH saved AS (
      UPDATE catalog_products SET available = $2 WHERE id = $1 RETURNING id, available
    )
    INSERT INTO catalog_audit_history (action, subject, details)
    SELECT 'availability.update', id, jsonb_build_object('available', available) FROM saved
  `, [id, available]);
  revalidatePath("/[lang]/admin", "page");
  revalidatePath("/[lang]/catalog", "page");
}

export async function saveCampaign(form: FormData) {
  if (!process.env.DATABASE_URL || await staffRole() !== "ADMIN") throw new Error("Forbidden");
  const date = z.union([z.literal(""), z.iso.datetime({ offset: true })]);
  const input = z.object({
    id: z.enum(["fresh-mango-series", "creme-brulee", "house-lemonade", "explore-menu"]),
    starts: date, ends: date,
    position: z.string().regex(/^(|[1-9][0-9]?)$/),
    headlineFr: z.string().trim().min(1).max(200),
    headlineEn: z.string().trim().min(1).max(200),
    seoFr: z.string().trim().max(250),
    seoEn: z.string().trim().max(250),
    image: z.string().regex(/^(|\/(drinks|promotions)\/[a-z0-9_-]+\.webp)$/i),
  }).refine(row => !row.starts || !row.ends || Date.parse(row.starts) < Date.parse(row.ends))
    .parse(Object.fromEntries(form));
  await (await database()).query(`
    WITH changed AS (
      UPDATE marketing_campaigns SET published = $2, active = $3, starts_at = $4, ends_at = $5,
        homepage_position = $6 WHERE id = $1 RETURNING id
    ), copy AS (
      UPDATE marketing_campaign_translations AS t
      SET headline = CASE WHEN t.locale = 'fr' THEN $7 ELSE $8 END,
          seo_description = NULLIF(CASE WHEN t.locale = 'fr' THEN $9 ELSE $10 END, '')
      FROM changed WHERE t.campaign_id = changed.id
    ), removed_assets AS (
      DELETE FROM marketing_campaign_assets a USING changed WHERE a.campaign_id = changed.id AND a.path <> $11
    ), assets AS (
      INSERT INTO marketing_campaign_assets SELECT id, $11 FROM changed WHERE $11 <> ''
      ON CONFLICT DO NOTHING
    )
    INSERT INTO catalog_audit_history (action, subject, details)
    SELECT 'campaign.update', id, '{}'::jsonb FROM changed
  `, [input.id, form.get("published") === "on", form.get("active") === "on",
    input.starts || null, input.ends || null, input.position ? Number(input.position) : null,
    input.headlineFr, input.headlineEn, input.seoFr, input.seoEn, input.image]);
  revalidatePath("/[lang]/admin", "page");
  revalidatePath("/[lang]", "page");
  revalidatePath("/[lang]/catalog/[collection]", "page");
}
