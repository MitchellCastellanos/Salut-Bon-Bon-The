import "server-only";
import source from "../catalog/official.json";
import { database } from "./db";
import type { Lang } from "./domain";

type Named = { id: string; fr: string; en: string };
type CatalogProduct = Named & { category: string; image: string | null };
type Campaign = Named & { headline_fr: string; headline_en: string; image: string | null };

export async function catalogCategories(): Promise<Named[]> {
  if (!process.env.DATABASE_URL) return source.categories;
  return (await (await database()).query<Named>(`
    SELECT * FROM catalog_categories ORDER BY array_position(
      ARRAY['milk-tea','fruit-tea','matcha','smoothies','lemonade','fresh-mango-series','creme-brulee'],
      id
    ), id
  `)).rows;
}

export async function catalogCollections(): Promise<Named[]> {
  if (!process.env.DATABASE_URL) return source.collections;
  return (await (await database()).query<Named>("SELECT * FROM catalog_collections ORDER BY id")).rows;
}

export async function catalogProducts(featured = false): Promise<CatalogProduct[]> {
  if (!process.env.DATABASE_URL) return source.products.map(product => ({ ...product, image: product.image ?? null }));
  const { rows } = await (await database()).query<CatalogProduct>(`
    SELECT p.id, p.category, fr.name AS fr, en.name AS en, i.path AS image
    FROM catalog_products p
    JOIN catalog_product_translations fr ON fr.product_id = p.id AND fr.locale = 'fr'
    JOIN catalog_product_translations en ON en.product_id = p.id AND en.locale = 'en'
    LEFT JOIN LATERAL (SELECT path FROM catalog_product_images WHERE product_id = p.id ORDER BY position, path LIMIT 1) i ON true
    LEFT JOIN catalog_featured_placements f ON f.product_id = p.id AND f.placement = 'homepage'
    WHERE NOT $1::boolean OR f.position IS NOT NULL
    ORDER BY CASE WHEN $1::boolean THEN f.position END, p.id
  `, [featured]);
  return rows;
}

export async function catalogCollection(id: string, lang: Lang) {
  let collection: Campaign & { products: string[]; seo_fr?: string; seo_en?: string } | undefined;
  if (!process.env.DATABASE_URL) {
    collection = source.collections.find(item => item.id === id);
  } else {
    const result = await (await database()).query<Campaign & { products: string[]; seo_fr?: string; seo_en?: string }>(`
      SELECT l.id, l.fr, l.en, fr.headline AS headline_fr, en.headline AS headline_en, a.path AS image,
        fr.seo_description AS seo_fr, en.seo_description AS seo_en,
        ARRAY(SELECT product_id FROM catalog_collection_products WHERE collection_id = l.id ORDER BY position, product_id) AS products
      FROM catalog_collections l
      JOIN marketing_campaigns c ON c.collection_id = l.id
      JOIN marketing_campaign_translations fr ON fr.campaign_id = c.id AND fr.locale = 'fr'
      JOIN marketing_campaign_translations en ON en.campaign_id = c.id AND en.locale = 'en'
      LEFT JOIN LATERAL (SELECT path FROM marketing_campaign_assets WHERE campaign_id = c.id ORDER BY path LIMIT 1) a ON true
      WHERE l.id = $1
    `, [id]);
    collection = result.rows[0];
  }
  if (!collection) return;
  return {
    ...collection,
    title: collection[lang],
    headline: lang === "fr" ? collection.headline_fr : collection.headline_en,
    seo: lang === "fr" ? collection.seo_fr : collection.seo_en,
  };
}

export async function visibleCampaigns(): Promise<Campaign[]> {
  if (!process.env.DATABASE_URL) return source.collections;
  const { rows } = await (await database()).query<Campaign>(`
    SELECT c.id, l.fr, l.en, fr.headline AS headline_fr, en.headline AS headline_en, a.path AS image
    FROM marketing_campaigns c
    JOIN catalog_collections l ON l.id = c.collection_id
    JOIN marketing_campaign_translations fr ON fr.campaign_id = c.id AND fr.locale = 'fr'
    JOIN marketing_campaign_translations en ON en.campaign_id = c.id AND en.locale = 'en'
    LEFT JOIN LATERAL (SELECT path FROM marketing_campaign_assets WHERE campaign_id = c.id ORDER BY path LIMIT 1) a ON true
    WHERE c.published AND c.active AND c.homepage_position IS NOT NULL
      AND (c.starts_at IS NULL OR c.starts_at <= now())
      AND (c.ends_at IS NULL OR c.ends_at > now())
    ORDER BY c.homepage_position, c.id
  `);
  return rows;
}
