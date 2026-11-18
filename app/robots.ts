import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  if (!process.env.SITE_URL) return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", disallow: ["/fr/staff", "/en/staff", "/fr/admin", "/en/admin", "/fr/track/", "/en/track/", "/fr/recompenses/carte", "/en/rewards/card"] }, sitemap: new URL("/sitemap.xml", process.env.SITE_URL).href };
}
