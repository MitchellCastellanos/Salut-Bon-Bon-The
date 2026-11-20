import { orderHref } from "../../../src/order-links";
import Image from "next/image";
import { hasPublicImage } from "../../../src/storefront-art";
import Link from "next/link";
import { StorefrontIcon } from "../../../src/storefront-art";
import { drinkPhoto } from "../../../src/drink-photography";
import { catalogCategories, catalogProducts } from "../../../src/catalog";
import type { Lang } from "../../../src/domain";

export async function CatalogList({ lang, category, search = "", ids, previewPrices, browseOnly = false }: {
  /** Hide the order action (ordering is not open, so there is nothing to customize). */
  browseOnly?: boolean;
  lang: Lang;
  category?: string;
  search?: string;
  ids?: string[];
  previewPrices?: Record<string, { cents: number; approved: boolean }>;
}) {
  const normalize = (value: string) => value.toLocaleLowerCase(lang).normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const query = normalize(search.trim());
  const [allProducts, categories] = await Promise.all([catalogProducts(), catalogCategories()]);
  const products = allProducts.filter(product =>
    (!category || product.category === category) &&
    (!ids || ids.includes(product.id)) &&
    [product.fr, product.en, product.id].some(value => normalize(value).includes(query))
  );
  if (ids) products.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  if (!products.length) return <p>{lang === "fr" ? "Aucun résultat." : "No results."}</p>;
  return <ul className="catalog-grid">
    {products.map(product => {
      const photo = drinkPhoto(product);
      return <li key={product.id} id={product.id}>
      <Link className={"catalog-visual catalog-visual--" + product.category} href={`/${lang}/catalog/products/${product.id}`} aria-label={product[lang]}>{photo && hasPublicImage(photo.path) ? <Image className="catalog-banner" src={photo.path} alt={photo.exact ? product[lang] : (lang === "fr" ? "Photo illustrative de boisson" : "Illustrative drink photo")} width={1200} height={1140} sizes="(max-width: 640px) 45vw, (max-width: 1000px) 30vw, 260px"/> : <span className="catalog-fallback"><StorefrontIcon name={product.category === "matcha" ? "matcha" : product.category === "smoothies" ? "smoothie" : product.category === "lemonade" ? "lemonade" : product.category === "fruit-tea" ? "fruit" : "milk"}/></span>}</Link>
      <Link href={`/${lang}/catalog/products/${product.id}`}><strong>{product[lang]}</strong></Link>
      <small>{categories.find(item => item.id === product.category)?.[lang]}</small>
      {previewPrices?.[product.id] && <span className="catalog-preview-price">{(previewPrices[product.id].cents / 100).toLocaleString(lang === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD" })}</span>}
      {!browseOnly && <Link className="catalog-add" href={orderHref(lang, product.id)}>{lang === "fr" ? "Personnaliser +" : "Customize +"}</Link>}
      {ids && <Link href={`/${lang}/catalog?category=${product.category}#order-${product.id}`}>
        {lang === "fr" ? "Voir au menu" : "View on the menu"}
      </Link>}
    </li>; })}
  </ul>;
}
