import { database } from "./db";

type Row = Record<string, unknown>;
export type Db = { query<T extends Row>(sql: string, args?: unknown[]): Promise<{ rows: T[] }> };
const handle = (db?: Db) => db ?? database();

type Poolish = { connect(): Promise<Db & { release(): void }> };
type Liteish = { transaction<T>(run: (tx: Db) => Promise<T>): Promise<T> };

/** Runs several statements as one unit: either the whole admin change is saved with its audit line or nothing is. */
export async function atomic<T>(db: Db, run: (tx: Db) => Promise<T>): Promise<T> {
  if ("transaction" in db) return (db as unknown as Liteish).transaction(run);
  if ("connect" in db) {
    const client = await (db as unknown as Poolish).connect();
    try {
      await client.query("BEGIN");
      const result = await run(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }
  return run(db);
}

export class MenuError extends Error {
  constructor(readonly code: "INVALID" | "NOT_FOUND" | "EXISTS" | "LIMITS") { super(code); }
}

/** One audit line per admin change, always carrying the acting account. */
export async function audit(db: Db, action: string, subject: string, details: Record<string, unknown>, actor: string) {
  await db.query("INSERT INTO catalog_audit_history (action, subject, details) VALUES ($1, $2, $3::jsonb)", [action, subject, JSON.stringify({ ...details, actor })]);
}

export const slugify = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);

/** Whole dollars and cents ("6.75", "7") to cents; blank means "not sold in this size". */
export function parseDollars(value: string, allowZero = false): number | null {
  const text = value.trim();
  if (text === "") return null;
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(text)) throw new MenuError("INVALID");
  const cents = Math.round(Number(text) * 100);
  if (cents < (allowZero ? 0 : 1) || cents > 100000) throw new MenuError("INVALID");
  return cents;
}

export type MenuRow = {
  id: string; category: string; categoryName: string; fr: string; en: string; published: boolean; available: boolean; image: string | null; featured: number | null;
  regular: number | null; large: number | null; regularPromo: number | null; largePromo: number | null; sellable: boolean; sample: boolean;
};

/** hidden: not on the website. soldout: on the website but cannot be ordered. unpriced/sample: orderable only once a price is approved. */
export type MenuStatus = "sellable" | "soldout" | "hidden" | "unpriced" | "sample";
export const statusOf = (row: Pick<MenuRow, "published" | "available" | "sellable" | "sample">): MenuStatus =>
  !row.published ? "hidden" : !row.available ? "soldout" : !row.sellable ? "unpriced" : row.sample ? "sample" : "sellable";

export async function listMenu(filter: { q?: string; category?: string; status?: MenuStatus | "" } = {}, db?: Db): Promise<MenuRow[]> {
  const { rows } = await (await handle(db)).query<MenuRow>(`
    SELECT p.id, p.category, c.en AS "categoryName", fr.name AS fr, en.name AS en, p.published, p.available, i.path AS image, f.position AS featured,
      r.price_cents AS regular, l.price_cents AS large, r.promotional_cents AS "regularPromo", l.promotional_cents AS "largePromo",
      coalesce((r.approved AND r.available AND r.price_cents > 0) OR (l.approved AND l.available AND l.price_cents > 0), false) AS sellable,
      coalesce((r.price_cents IS NOT NULL AND NOT r.approved) OR (l.price_cents IS NOT NULL AND NOT l.approved), false) AS sample
    FROM catalog_products p
    JOIN catalog_categories c ON c.id = p.category
    JOIN catalog_product_translations fr ON fr.product_id = p.id AND fr.locale = 'fr'
    JOIN catalog_product_translations en ON en.product_id = p.id AND en.locale = 'en'
    LEFT JOIN catalog_variants r ON r.product_id = p.id AND r.id = 'regular'
    LEFT JOIN catalog_variants l ON l.product_id = p.id AND l.id = 'large'
    LEFT JOIN LATERAL (SELECT path FROM catalog_product_images WHERE product_id = p.id ORDER BY position, path LIMIT 1) i ON true
    LEFT JOIN catalog_featured_placements f ON f.product_id = p.id AND f.placement = 'homepage'
    ORDER BY c.id, en.name`);
  const q = (filter.q ?? "").trim().toLowerCase();
  return rows.filter(row => (!q || [row.id, row.fr, row.en].some(text => text.toLowerCase().includes(q))) &&
    (!filter.category || row.category === filter.category) && (!filter.status || statusOf(row) === filter.status));
}

export async function menuWarnings(db?: Db) {
  const { rows: [counts] } = await (await handle(db)).query<{ offered: number; hidden: number; soldout: number; unpriced: number; sample: number; no_image: number; topping_off: number }>(`
    WITH m AS (
      SELECT p.id, p.published, p.available,
        coalesce(bool_or(v.approved AND v.available AND v.price_cents > 0), false) AS sellable,
        coalesce(bool_or(v.price_cents IS NOT NULL AND NOT v.approved), false) AS sample
      FROM catalog_products p LEFT JOIN catalog_variants v ON v.product_id = p.id AND v.id IN ('regular', 'large') GROUP BY p.id, p.published, p.available)
    SELECT count(*) FILTER (WHERE published AND available AND sellable)::int AS offered,
      count(*) FILTER (WHERE NOT published)::int AS hidden,
      count(*) FILTER (WHERE published AND NOT available)::int AS soldout,
      count(*) FILTER (WHERE published AND available AND NOT sellable)::int AS unpriced,
      count(*) FILTER (WHERE published AND available AND sellable AND sample)::int AS sample,
      count(*) FILTER (WHERE published AND available AND NOT EXISTS (SELECT 1 FROM catalog_product_images i WHERE i.product_id = m.id))::int AS no_image,
      (SELECT count(*)::int FROM catalog_modifiers WHERE NOT available OR surcharge_cents IS NULL) AS topping_off
    FROM m`);
  return counts;
}

/** Sold out / back on sale: the drink stays on the website but cannot be ordered while unavailable. */
export async function setProductAvailable(id: string, available: boolean, actor: string, db?: Db) {
  const d = await handle(db);
  const { rows } = await d.query<{ id: string }>("UPDATE catalog_products SET available = $2 WHERE id = $1 RETURNING id", [id, available]);
  if (!rows.length) throw new MenuError("NOT_FOUND");
  await audit(d, "availability.update", id, { available }, actor);
}

const label = (value: string) => { const text = value.trim(); if (!text || text.length > 150) throw new MenuError("INVALID"); return text; };
const idPattern = /^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/;

export type ProductInput = {
  id: string; fr: string; en: string; category: string; image: string; featured: number | null; published: boolean; available: boolean;
  regular: number | null; large: number | null; regularPromo: number | null; largePromo: number | null;
};

function checkPrices(input: ProductInput) {
  for (const [price, promo] of [[input.regular, input.regularPromo], [input.large, input.largePromo]] as const) {
    if (promo !== null && (price === null || promo >= price)) throw new MenuError("INVALID");
  }
}

/** Saves names, category, image, featured slot, availability and both sizes. Saving a price is the owner approving it; a blank size is not sold. */
export async function saveProduct(input: ProductInput, actor: string, db?: Db) {
  const d = await handle(db);
  if (!idPattern.test(input.id) || !/^(|\/(catalog|drinks|promotions)\/[A-Za-z0-9_-]+\.webp)$/.test(input.image) ||
      (input.featured !== null && (input.featured < 1 || input.featured > 99))) throw new MenuError("INVALID");
  const fr = label(input.fr), en = label(input.en);
  checkPrices(input);
  const { rows: [category] } = await d.query<{ id: string }>("SELECT id FROM catalog_categories WHERE id = $1", [input.category]);
  if (!category) throw new MenuError("INVALID");
  const { rows: [existing] } = await d.query<{ id: string }>("SELECT id FROM catalog_products WHERE id = $1", [input.id]);
  if (!existing) throw new MenuError("NOT_FOUND");
  await atomic(d, async d => {
  await d.query(`
    WITH updated AS (UPDATE catalog_products SET category = $2, available = $3, published = $8 WHERE id = $1 RETURNING id),
    names AS (UPDATE catalog_product_translations t SET name = CASE WHEN t.locale = 'fr' THEN $4 ELSE $5 END FROM updated WHERE t.product_id = updated.id),
    removed_images AS (DELETE FROM catalog_product_images i USING updated WHERE i.product_id = updated.id AND i.path <> $6),
    saved_image AS (INSERT INTO catalog_product_images (product_id, path, position) SELECT id, $6, 1 FROM updated WHERE $6 <> '' ON CONFLICT (product_id, path) DO UPDATE SET position = 1),
    removed_feature AS (DELETE FROM catalog_featured_placements f USING updated WHERE f.product_id = updated.id AND f.placement = 'homepage' AND $7::integer IS NULL),
    featured AS (INSERT INTO catalog_featured_placements (placement, product_id, position) SELECT 'homepage', id, $7::integer FROM updated WHERE $7::integer IS NOT NULL
      ON CONFLICT (placement, product_id) DO UPDATE SET position = excluded.position)
    SELECT 1`, [input.id, input.category, input.available, fr, en, input.image, input.featured, input.published]);
  await storePrices(d, input.id, [["regular", input.regular, input.regularPromo], ["large", input.large, input.largePromo]]);
  await audit(d, "product.update", input.id, { category: input.category, published: input.published, available: input.available, regular: input.regular, large: input.large,
    regularPromo: input.regularPromo, largePromo: input.largePromo, image: input.image, featured: input.featured }, actor);
  });
}

async function storePrices(d: Db, id: string, sizes: readonly (readonly [string, number | null, number | null])[]) {
  for (const [size, price, promo] of sizes) {
    if (price === null) {
      await d.query("UPDATE catalog_variants SET approved = false, available = false, promotional_cents = NULL WHERE product_id = $1 AND id = $2", [id, size]);
    } else {
      await d.query(`
        INSERT INTO catalog_variants (product_id, id, fr, en, price_cents, promotional_cents, approved, available)
        VALUES ($1, $2, $3, $4, $5, $6, true, true)
        ON CONFLICT (product_id, id) DO UPDATE SET price_cents = $5, promotional_cents = $6, approved = true, available = true`,
        [id, size, size === "regular" ? "Régulier" : "Grand", size === "regular" ? "Regular" : "Large", price, promo]);
    }
  }
}

/** Creates a product (hidden until it is priced and shown). Toppings are copied from a drink in the same category, or from the first drink. */
export async function createProduct(input: Omit<ProductInput, "id" | "featured" | "published"> & { id?: string }, actor: string, db?: Db) {
  const d = await handle(db);
  const fr = label(input.fr), en = label(input.en);
  checkPrices({ ...input, id: "x", featured: null, published: true });
  if (!/^(|\/(catalog|drinks|promotions)\/[A-Za-z0-9_-]+\.webp)$/.test(input.image)) throw new MenuError("INVALID");
  const { rows: [category] } = await d.query<{ id: string }>("SELECT id FROM catalog_categories WHERE id = $1", [input.category]);
  if (!category) throw new MenuError("INVALID");
  const base = input.id || slugify(en);
  if (!idPattern.test(base)) throw new MenuError("INVALID");
  const { rows: [taken] } = await d.query<{ id: string }>("SELECT id FROM catalog_products WHERE id = $1", [base]);
  if (taken) throw new MenuError("EXISTS");
  const { rows: [template] } = await d.query<{ id: string }>(`
    SELECT p.id FROM catalog_products p WHERE p.id <> $1 AND EXISTS (SELECT 1 FROM catalog_product_modifier_groups g WHERE g.product_id = p.id)
    ORDER BY (p.category = $2) DESC, p.id LIMIT 1`, [base, input.category]);
  await atomic(d, async d => {
  await d.query("INSERT INTO catalog_products (id, category, available, published) VALUES ($1, $2, false, false)", [base, input.category]);
  await d.query("INSERT INTO catalog_product_translations (product_id, locale, name) VALUES ($1, 'fr', $2), ($1, 'en', $3)", [base, fr, en]);
  if (input.image) await d.query("INSERT INTO catalog_product_images (product_id, path, position) VALUES ($1, $2, 1)", [base, input.image]);
  await storePrices(d, base, [["regular", input.regular, input.regularPromo], ["large", input.large, input.largePromo]]);
  if (template) {
    await d.query("INSERT INTO catalog_product_modifier_groups SELECT $1, group_id, min_selections, max_selections FROM catalog_product_modifier_groups WHERE product_id = $2", [base, template.id]);
    await d.query("INSERT INTO catalog_product_modifiers SELECT $1, group_id, modifier_id, selected_by_default FROM catalog_product_modifiers WHERE product_id = $2", [base, template.id]);
  }
  // "Show on the menu now" publishes the drink and opens it for ordering; otherwise it stays a hidden draft.
  if (input.available) await d.query("UPDATE catalog_products SET available = true, published = true WHERE id = $1", [base]);
  await audit(d, "product.create", base, { category: input.category, regular: input.regular, large: input.large, available: input.available, toppingsFrom: template?.id ?? null }, actor);
  });
  return base;
}

export type ToppingAssignment = { product: string; group: string; min: number; max: number; eligible: string[]; defaults: string[] };

/** Which toppings of one group a drink offers, how many the customer may take, and which are preselected. */
export async function saveToppings(input: ToppingAssignment, actor: string, db?: Db) {
  const d = await handle(db);
  const { product, group, min, max, eligible, defaults } = input;
  if (!idPattern.test(product) || !idPattern.test(group) || !Number.isInteger(min) || !Number.isInteger(max) || min < 0 || min > max || max > eligible.length ||
      new Set(eligible).size !== eligible.length || defaults.length > max || !defaults.every(option => eligible.includes(option))) throw new MenuError("LIMITS");
  const { rows: valid } = await d.query<{ id: string }>("SELECT id FROM catalog_modifiers WHERE group_id = $1 AND id = ANY($2::text[])", [group, eligible]);
  if (valid.length !== eligible.length) throw new MenuError("INVALID");
  const { rows: [exists] } = await d.query<{ id: string }>("SELECT id FROM catalog_products WHERE id = $1", [product]);
  if (!exists) throw new MenuError("NOT_FOUND");
  await atomic(d, async d => {
  await d.query(`
    WITH saved AS (
      INSERT INTO catalog_product_modifier_groups (product_id, group_id, min_selections, max_selections) VALUES ($1, $2, $3, $4)
      ON CONFLICT (product_id, group_id) DO UPDATE SET min_selections = excluded.min_selections, max_selections = excluded.max_selections RETURNING *),
    removed AS (DELETE FROM catalog_product_modifiers m USING saved WHERE (m.product_id, m.group_id) = (saved.product_id, saved.group_id) AND NOT (m.modifier_id = ANY($5::text[]))),
    choices AS (INSERT INTO catalog_product_modifiers SELECT product_id, group_id, option, option = ANY($6::text[]) FROM saved, unnest($5::text[]) AS option
      ON CONFLICT (product_id, modifier_id) DO UPDATE SET selected_by_default = excluded.selected_by_default)
    SELECT 1`, [product, group, min, max, eligible, defaults]);
  // The checkout rule gives every drink one included topping from tapioca or popping pearls: a drink may not be left without any.
  const { rows: [pool] } = await d.query<{ groups: number; options: number }>(`
    SELECT (SELECT count(*)::int FROM catalog_product_modifier_groups WHERE product_id = $1 AND group_id IN ('tapioca', 'popping')) AS groups,
           (SELECT count(*)::int FROM catalog_product_modifiers WHERE product_id = $1 AND group_id IN ('tapioca', 'popping')) AS options`, [product]);
  if (pool.groups > 0 && pool.options === 0) throw new MenuError("LIMITS");
  await audit(d, "eligibility.update", product, { group, min, max, eligible, defaults }, actor);
  });
}

export async function saveCategory(input: { id: string; fr: string; en: string }, actor: string, create: boolean, db?: Db) {
  const d = await handle(db);
  const fr = label(input.fr), en = label(input.en);
  const id = create ? (input.id || slugify(en)) : input.id;
  if (!idPattern.test(id)) throw new MenuError("INVALID");
  if (create) {
    const { rows: [taken] } = await d.query<{ id: string }>("SELECT id FROM catalog_categories WHERE id = $1", [id]);
    if (taken) throw new MenuError("EXISTS");
    await d.query("INSERT INTO catalog_categories (id, fr, en) VALUES ($1, $2, $3)", [id, fr, en]);
  } else {
    const { rows } = await d.query("UPDATE catalog_categories SET fr = $2, en = $3 WHERE id = $1 RETURNING id", [id, fr, en]);
    if (!rows.length) throw new MenuError("NOT_FOUND");
  }
  await audit(d, create ? "category.create" : "category.update", id, { fr, en }, actor);
}

export async function saveTopping(input: { id: string; fr: string; en: string; cents: number | null; available: boolean }, actor: string, db?: Db) {
  const d = await handle(db);
  const fr = label(input.fr), en = label(input.en);
  if (input.cents !== null && (input.cents < 0 || input.cents > 100000)) throw new MenuError("INVALID");
  const { rows } = await d.query("UPDATE catalog_modifiers SET fr = $2, en = $3, surcharge_cents = $4, available = $5 WHERE id = $1 RETURNING id", [input.id, fr, en, input.cents, input.available]);
  if (!rows.length) throw new MenuError("NOT_FOUND");
  await audit(d, "modifier.update", input.id, { fr, en, cents: input.cents, available: input.available }, actor);
}

export async function createTopping(input: { group: string; fr: string; en: string; cents: number | null; available: boolean }, actor: string, db?: Db) {
  const d = await handle(db);
  const fr = label(input.fr), en = label(input.en);
  const { rows: [group] } = await d.query<{ id: string }>("SELECT id FROM catalog_modifier_groups WHERE id = $1", [input.group]);
  if (!group || (input.cents !== null && (input.cents < 0 || input.cents > 100000))) throw new MenuError("INVALID");
  const id = `${input.group}-${slugify(en)}`.slice(0, 64);
  if (!idPattern.test(id)) throw new MenuError("INVALID");
  const { rows: [taken] } = await d.query<{ id: string }>("SELECT id FROM catalog_modifiers WHERE id = $1", [id]);
  if (taken) throw new MenuError("EXISTS");
  await d.query("INSERT INTO catalog_modifiers (id, group_id, fr, en, surcharge_cents, available) VALUES ($1, $2, $3, $4, $5, $6)", [id, input.group, fr, en, input.cents, input.available]);
  await audit(d, "modifier.create", id, { group: input.group, fr, en, cents: input.cents }, actor);
  return id;
}

/** Collections feed the homepage campaigns: the owner picks products from a list instead of typing identifiers. */
export async function saveCollection(input: { id: string; fr: string; en: string; products: string[] }, actor: string, db?: Db) {
  const d = await handle(db);
  const fr = label(input.fr), en = label(input.en);
  if (!idPattern.test(input.id) || new Set(input.products).size !== input.products.length || input.products.length > 120) throw new MenuError("INVALID");
  const { rows: known } = await d.query<{ id: string }>("SELECT id FROM catalog_products WHERE id = ANY($1::text[])", [input.products]);
  if (known.length !== input.products.length) throw new MenuError("INVALID");
  const { rows } = await d.query("UPDATE catalog_collections SET fr = $2, en = $3 WHERE id = $1 RETURNING id", [input.id, fr, en]);
  if (!rows.length) throw new MenuError("NOT_FOUND");
  await atomic(d, async d => {
  await d.query("DELETE FROM catalog_collection_products WHERE collection_id = $1 AND NOT (product_id = ANY($2::text[]))", [input.id, input.products]);
  await d.query(`INSERT INTO catalog_collection_products (collection_id, product_id, position)
    SELECT $1, e.product_id, e.position FROM unnest($2::text[]) WITH ORDINALITY AS e(product_id, position)
    ON CONFLICT (collection_id, product_id) DO UPDATE SET position = excluded.position`, [input.id, input.products]);
  await audit(d, "collection.update", input.id, { products: input.products }, actor);
  });
}
