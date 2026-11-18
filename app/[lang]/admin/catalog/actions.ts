"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { database } from "../../../../src/db";
import { staffRole } from "../../../../src/staff";

const id = z.string().regex(/^[a-z0-9-]{1,64}$/i);
const label = z.string().trim().min(1).max(150);
const image = z.string().regex(/^(|\/(catalog|drinks|promotions)\/[a-z0-9_-]+\.webp)$/i);

export async function editCatalog(form: FormData) {
  if (!process.env.DATABASE_URL || await staffRole() !== "ADMIN") throw new Error("Forbidden");
  const row = z.discriminatedUnion("type", [
    z.object({ type: z.literal("product"), id, fr: label, en: label, category: id, image,
      featured: z.string().regex(/^(|[1-9][0-9]?)$/) }),
    z.object({ type: z.literal("category"), id, fr: label, en: label }),
    z.object({ type: z.literal("collection"), id, fr: label, en: label, products: z.string().max(3000) }),
    z.object({ type: z.literal("modifier"), id, fr: label, en: label, cents: z.string().regex(/^(|\d{1,6})$/) }),
  ]).parse(Object.fromEntries(form));
  const db = await database();
  switch (row.type) {
    case "product":
      await db.query(`
        WITH updated AS (
          UPDATE catalog_products SET category = $4 WHERE id = $1 RETURNING id
        ), names AS (
          UPDATE catalog_product_translations t SET name = CASE WHEN t.locale = 'fr' THEN $2 ELSE $3 END
          FROM updated WHERE t.product_id = updated.id
        ), removed_images AS (
          DELETE FROM catalog_product_images i USING updated WHERE i.product_id = updated.id AND i.path <> $5
        ), saved_image AS (
          INSERT INTO catalog_product_images (product_id, path, position)
          SELECT id, $5, 1 FROM updated WHERE $5 <> ''
          ON CONFLICT (product_id, path) DO UPDATE SET position = excluded.position
        ), removed_feature AS (
          DELETE FROM catalog_featured_placements f USING updated
          WHERE f.product_id = updated.id AND f.placement = 'homepage' AND $6::integer IS NULL
        ), featured AS (
          INSERT INTO catalog_featured_placements (placement, product_id, position)
          SELECT 'homepage', id, $6::integer FROM updated WHERE $6::integer IS NOT NULL
          ON CONFLICT (placement, product_id) DO UPDATE SET position = excluded.position
        )
        INSERT INTO catalog_audit_history (action, subject, details)
        SELECT 'product.update', id, jsonb_build_object('category', $4::text, 'image', $5::text, 'position', $6::integer) FROM updated
      `, [row.id, row.fr, row.en, row.category, row.image, row.featured ? Number(row.featured) : null]);
      break;
    case "category":
      await db.query(`
        WITH saved AS (UPDATE catalog_categories SET fr = $2, en = $3 WHERE id = $1 RETURNING *)
        INSERT INTO catalog_audit_history (action, subject, details) SELECT 'category.update', id, to_jsonb(saved) FROM saved
      `, [row.id, row.fr, row.en]);
      break;
    case "collection": {
      const products = row.products.trim() ? z.array(id).max(62).parse(row.products.split(",").map(value => value.trim())) : [];
      if (new Set(products).size !== products.length) throw new Error("Duplicate product");
      await db.query(`
        WITH saved AS (
          UPDATE catalog_collections SET fr = $2, en = $3 WHERE id = $1 RETURNING id
        ), removed AS (
          DELETE FROM catalog_collection_products m USING saved
          WHERE m.collection_id = saved.id AND NOT (m.product_id = ANY($4::text[]))
        ), members AS (
          INSERT INTO catalog_collection_products (collection_id, product_id, position)
          SELECT saved.id, entry.product_id, entry.position
          FROM saved, unnest($4::text[]) WITH ORDINALITY AS entry(product_id, position)
          ON CONFLICT (collection_id, product_id) DO UPDATE SET position = excluded.position
        )
        INSERT INTO catalog_audit_history (action, subject, details)
        SELECT 'collection.update', id, to_jsonb($4::text[]) FROM saved
      `, [row.id, row.fr, row.en, products]);
      break;
    }
    case "modifier":
      await db.query(`
        WITH saved AS (
          UPDATE catalog_modifiers SET fr = $2, en = $3, surcharge_cents = $4, available = $5 WHERE id = $1 RETURNING *
        )
        INSERT INTO catalog_audit_history (action, subject, details) SELECT 'modifier.update', id, to_jsonb(saved) FROM saved
      `, [row.id, row.fr, row.en, row.cents ? Number(row.cents) : null, form.get("available") === "on"]);
      break;
  }
  revalidatePath("/[lang]", "layout");
}

export async function editEligibility(form: FormData) {
  if (!process.env.DATABASE_URL || await staffRole() !== "ADMIN") throw new Error("Forbidden");
  const fields = z.object({
    product: id,
    group: id,
    min: z.string().regex(/^\d{1,2}$/).transform(Number),
    max: z.string().regex(/^\d{1,2}$/).transform(Number),
    eligible: z.string().max(1500),
    defaults: z.string().max(1500),
  }).parse(Object.fromEntries(form));
  const { product, group, min, max } = fields;
  const list = (value: string) => value.trim() ? z.array(id).max(18).parse(value.split(",").map(item => item.trim())) : [];
  const eligible = list(fields.eligible);
  const defaults = list(fields.defaults);
  if (min > max || max > eligible.length || defaults.length > max ||
      new Set(eligible).size !== eligible.length || new Set(defaults).size !== defaults.length ||
      !defaults.every(option => eligible.includes(option))) throw new Error("Invalid modifier limits or assignments");
  await (await database()).query(`
    WITH saved AS (
      INSERT INTO catalog_product_modifier_groups (product_id, group_id, min_selections, max_selections)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (product_id, group_id) DO UPDATE SET
        min_selections = excluded.min_selections, max_selections = excluded.max_selections
      RETURNING *
    ), removed AS (
      DELETE FROM catalog_product_modifiers m USING saved WHERE (m.product_id, m.group_id) = (saved.product_id, saved.group_id)
        AND NOT (m.modifier_id = ANY($5::text[]))
    ), choices AS (
      INSERT INTO catalog_product_modifiers
      SELECT product_id, group_id, option, option = ANY($6::text[]) FROM saved, unnest($5::text[]) AS option
      ON CONFLICT (product_id, modifier_id) DO UPDATE SET selected_by_default = excluded.selected_by_default
    )
    INSERT INTO catalog_audit_history (action, subject, details)
    SELECT 'eligibility.update', product_id, to_jsonb(saved) FROM saved
  `, [product, group, min, max, eligible, defaults]);
  revalidatePath("/[lang]", "layout");
}
