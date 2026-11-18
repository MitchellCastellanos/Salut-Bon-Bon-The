import catalog from "../catalog/official.json";
import type { MetadataRoute } from "next";
import { loyaltyProgram } from "../src/loyalty";
import { rewardsPath } from "../src/rewards-paths";
// Reads the live preview switch, so it must not be frozen at build time.
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.SITE_URL;
  if (!base) return [];
  const pages = ["fr", "en"].flatMap(lang => ["", "/catalog", ...catalog.collections.map(item => `/catalog/${item.id}`)]
    .map(path => ({ url: new URL(`/${lang}${path}`, base).href })));
  // The rewards pages are listed only while the ADMIN keeps the public preview visible.
  const visible = await loyaltyProgram().then(program => program.previewVisible, () => true);
  const rewards = !visible ? [] : (["fr", "en"] as const).map(lang => ({ url: new URL(rewardsPath[lang], base).href,
    alternates: { languages: { "fr-CA": new URL(rewardsPath.fr, base).href, "en-CA": new URL(rewardsPath.en, base).href } } }));
  return [...pages, ...rewards];
}
