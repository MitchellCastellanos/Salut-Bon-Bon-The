import type { Lang } from "./domain";

const kinds: Record<string, Record<Lang, string>> = {
  "milk-tea": { fr: "Thé au lait", en: "Milk Tea" },
  "fruit-tea": { fr: "Thé aux fruits", en: "Fruit Tea" },
  matcha: { fr: "Matcha", en: "Matcha" },
  smoothies: { fr: "Smoothie", en: "Smoothie" },
  lemonade: { fr: "Limonade", en: "Lemonade" },
  "fresh-mango-series": { fr: "Série mangue fraîche", en: "Fresh Mango Series" },
  "creme-brulee": { fr: "Crème brûlée", en: "Crème Brûlée" },
};

/** Presentation-only labels; never mutate canonical names used by admin or orders. */
export function productKind(category: string, lang: Lang): string {
  return kinds[category]?.[lang] ?? "";
}
export function productDisplayName(name: string, category: string, lang: Lang): string {
  const kind = productKind(category, lang);
  if (!kind) return name;
  // These collections already use descriptive names; don't repeat their type.
  if (category === "fresh-mango-series" || category === "creme-brulee") return name;
  if (category === "matcha" && /matcha/i.test(name)) return name;
  if (category === "lemonade" && /limonade|lemonade/i.test(name)) return name;
  return lang === "fr" ? `${kind} · ${name}` : `${kind} · ${name}`;
}
