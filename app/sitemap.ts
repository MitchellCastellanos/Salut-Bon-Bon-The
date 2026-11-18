import catalog from "../catalog/official.json";
import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.SITE_URL;
  if (!base) return [];
  return ["fr", "en"].flatMap(lang => ["", "/catalog", ...catalog.collections.map(item => `/catalog/${item.id}`)]
    .map(path => ({ url: new URL(`/${lang}${path}`, base).href })));
}
