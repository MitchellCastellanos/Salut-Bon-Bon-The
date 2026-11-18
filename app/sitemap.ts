import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.SITE_URL;
  if (!base) return [];
  return ["/fr", "/en", "/fr/menu", "/en/menu"].map(path => ({ url: new URL(path, base).href }));
}
