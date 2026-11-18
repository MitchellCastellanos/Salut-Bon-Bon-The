/**
 * Photography already committed to public/. Prefer the product's actual catalog
 * photo. Other photos are illustrative category imagery, not exact product shots.
 * Never use marketing banners as individual product photographs.
 */
export function drinkPhoto(product: { id: string; category: string; fr: string; en: string; image: string | null }): { path: string; exact: boolean } | null {
  if (product.image) return { path: product.image, exact: true };
  const name = (product.fr + " " + product.en).toLowerCase();
  if (/matcha/.test(name)) return { path: "/drinks/matcha.webp", exact: false };
  if (/taro/.test(name)) return { path: "/drinks/taro.webp", exact: false };
  if (/strawberry|fraise/.test(name)) return { path: "/drinks/strawberry.webp", exact: false };
  if (/mango|mangue/.test(name)) return { path: "/drinks/mango.webp", exact: false };
  if (/lemonade|limonade/.test(name)) return { path: "/promotions/house-lemonade.webp", exact: false };
  if (/crème brûlée|creme brulee/.test(name)) return { path: "/catalog/creme-brulee.webp", exact: false };
  if (/classic|classique/.test(name)) return { path: "/drinks/classic.webp", exact: false };
  return ({
    "milk-tea": "/drinks/classic.webp",
    "fruit-tea": "/drinks/strawberry.webp",
    matcha: "/drinks/matcha.webp",
    smoothies: "/drinks/mango.webp",
    lemonade: "/promotions/house-lemonade.webp",
    "fresh-mango-series": "/drinks/mango.webp",
    "creme-brulee": "/catalog/creme-brulee.webp",
  } as Record<string,string>)[product.category]
    ? { path: ({
      "milk-tea": "/drinks/classic.webp",
      "fruit-tea": "/drinks/strawberry.webp",
      matcha: "/drinks/matcha.webp",
      smoothies: "/drinks/mango.webp",
      lemonade: "/promotions/house-lemonade.webp",
      "fresh-mango-series": "/drinks/mango.webp",
      "creme-brulee": "/catalog/creme-brulee.webp",
    } as Record<string,string>)[product.category], exact: false }
    : null;
}
