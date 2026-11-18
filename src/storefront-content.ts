import type { Lang } from "./domain";

export const rewardsName = { fr: "Récompenses Salut", en: "Salut Rewards" } satisfies Record<Lang, string>;
export const menuTiles = [
  { icon: "milk", fr: "Bubble thé au lait", en: "Milk bubble tea", filter: "milk" },
  { icon: "fruit", fr: "Thés aux fruits", en: "Fruit teas", filter: "fruit" },
  { icon: "smoothie", fr: "Smoothies", en: "Smoothies" },
  { icon: "lemonade", fr: "Limonades maison", en: "House lemonades" },
  { icon: "matcha", fr: "Matcha", en: "Matcha", filter: "matcha" },
  { icon: "pearls", fr: "Perles explosives", en: "Popping pearls", filter: "fruit" },
  { icon: "jelly", fr: "Gelées", en: "Jellies" },
] as const;

export function instagramUrl() {
  const url = process.env.INSTAGRAM_URL;
  if (!url) return;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" && ["instagram.com", "www.instagram.com"].includes(parsed.host) &&
      !parsed.username && !parsed.password && /^\/[a-z0-9_.]+\/?$/i.test(parsed.pathname)) return parsed.href;
  } catch { /* Hide the link until a valid official URL is supplied. */ }
}
