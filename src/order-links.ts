import type { Lang } from "./domain";

/**
 * Where "Order" and "Add to cart" lead. With a database the real pickup ordering section of the catalog is used, so orders reach the
 * staff queue. Without a database only the isolated local demonstration exists.
 */
export function orderHref(lang: Lang, product?: string) {
  if (process.env.DATABASE_URL) return product ? `/${lang}/catalog?customize=${encodeURIComponent(product)}` : `/${lang}/catalog#orderable`;
  return `/${lang}/${lang === "fr" ? "demo-commande" : "demo-order"}${product ? `?product=${encodeURIComponent(product)}` : ""}`;
}

/** The cart sits on the same page as the menu; with a database the header cart icon goes straight to it. */
export function cartHref(lang: Lang) {
  return process.env.DATABASE_URL ? `/${lang}/catalog#cart` : orderHref(lang);
}
