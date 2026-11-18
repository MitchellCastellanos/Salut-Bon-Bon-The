import "server-only";
import source from "../catalog/official.json";
import { database } from "./db";
import type { Lang } from "./domain";

export const catalogCategories = source.categories;
export const catalogCollections = source.collections;

type CatalogProduct = {
  id: string;
  category: string;
  fr: string;
  en: string;
};

export async function catalogProducts(): Promise<CatalogProduct[]> {
  if (!process.env.DATABASE_URL) return source.products;
  const db = await database();
  const { rows } = await db.query<CatalogProduct>(`
    SELECT p.id, p.category, fr.name AS fr, en.name AS en
    FROM catalog_products p
    JOIN catalog_product_translations fr ON fr.product_id = p.id AND fr.locale = 'fr'
    JOIN catalog_product_translations en ON en.product_id = p.id AND en.locale = 'en'
    ORDER BY p.id
  `);
  return rows;
}

export function catalogCollection(id: string, lang: Lang) {
  const collection = catalogCollections.find(item => item.id === id);
  if (!collection) return;
  return {
    ...collection,
    title: collection[lang],
    headline: lang === "fr" ? collection.headline_fr : collection.headline_en,
  };
}


export async function visibleCampaigns() {
  if (!process.env.DATABASE_URL) return catalogCollections;
  const { rows } = await (await database()).query<{
    id: string; fr: string; en: string; headline_fr: string; headline_en: string;
  }>(`
    SELECT c.id, l.fr, l.en, fr.headline AS headline_fr, en.headline AS headline_en
    FROM marketing_campaigns c
    JOIN catalog_collections l ON l.id = c.collection_id
    JOIN marketing_campaign_translations fr ON fr.campaign_id = c.id AND fr.locale = 'fr'
    JOIN marketing_campaign_translations en ON en.campaign_id = c.id AND en.locale = 'en'
    WHERE c.published AND c.active AND c.homepage_position IS NOT NULL
      AND (c.starts_at IS NULL OR c.starts_at <= now())
      AND (c.ends_at IS NULL OR c.ends_at > now())
    ORDER BY c.homepage_position, c.id
  `);
  return rows;
}
