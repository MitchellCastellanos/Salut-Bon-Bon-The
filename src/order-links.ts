import type { Lang } from "./domain";

/**
 * Where "Order" and "Add to cart" lead. With a database the real pickup ordering section of the catalog is used, so orders reach the
 * staff queue. Without a database only the isolated local demonstration exists.
 */
export function orderHref(lang: Lang, product?: string) {
  if (process.env.DATABASE_URL) return `/${lang}/catalog#${product ? `order-${encodeURIComponent(product)}` : "orderable"}`;
  return `/${lang}/${lang === "fr" ? "demo-commande" : "demo-order"}${product ? `?product=${encodeURIComponent(product)}` : ""}`;
}
