import Image from "next/image";
import { CatalogProductLink } from "./product-link";
import { hasPublicImage } from "../../../src/storefront-art";
import Link from "next/link";
import { StorefrontIcon } from "../../../src/storefront-art";
import { drinkPhoto } from "../../../src/drink-photography";
import { catalogCategories, catalogProducts } from "../../../src/catalog";
import type { Lang } from "../../../src/domain";
import { productDisplayName } from "../../../src/product-display";

export async function CatalogList({ lang, category, search = "", ids, previewPrices }: {
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
  const sections = category ? [{ id: category, title: categories.find(item => item.id === category)?.[lang] ?? category, products }] : categories.map(item => ({ id: item.id, title: item[lang], products: products.filter(product => product.category === item.id) })).filter(section => section.products.length);
  return <div className="catalog-sections">
    {sections.map(section => <section className="catalog-section" key={section.id} aria-labelledby={`category-${section.id}`}>
      <h2 id={`category-${section.id}`}>{section.title}</h2>
      <ul className="catalog-grid">
    {section.products.map(product => {
      const photo = drinkPhoto(product);
      return <li key={product.id} id={product.id}>
      <CatalogProductLink productId={product.id} className={"catalog-visual catalog-visual--" + product.category} href={`/${lang}/catalog/products/${product.id}`} ariaLabel={productDisplayName(product[lang], product.category, lang)}>{photo && hasPublicImage(photo.path) ? <Image className="catalog-banner" src={photo.path} alt={photo.exact ? product[lang] : (lang === "fr" ? "Photo illustrative de boisson" : "Illustrative drink photo")} width={1200} height={1140} sizes="(max-width: 640px) 45vw, (max-width: 1000px) 30vw, 260px"/> : <span className="catalog-fallback"><StorefrontIcon name={product.category === "matcha" ? "matcha" : product.category === "smoothies" ? "smoothie" : product.category === "lemonade" ? "lemonade" : product.category === "fruit-tea" ? "fruit" : "milk"}/></span>}</CatalogProductLink>
      <CatalogProductLink productId={product.id} href={`/${lang}/catalog/products/${product.id}`}><strong>{productDisplayName(product[lang], product.category, lang)}</strong></CatalogProductLink>
      <small>{categories.find(item => item.id === product.category)?.[lang]}</small>
      {previewPrices?.[product.id] && <span className="catalog-preview-price">{(previewPrices[product.id].cents / 100).toLocaleString(lang === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD" })}</span>}
      {product.available ? <CatalogProductLink productId={product.id} className="catalog-add" href={`/${lang}/catalog/products/${product.id}`}>{lang === "fr" ? "Personnaliser +" : "Customize +"}</CatalogProductLink>
        : <span className="catalog-preview-price" data-testid="unavailable">{lang === "fr" ? "Momentanément indisponible" : "Currently unavailable"}</span>}
      {ids && <Link href={`/${lang}/catalog?category=${product.category}#${product.id}`}>
        {lang === "fr" ? "Voir au menu" : "View on the menu"}
      </Link>}
    </li>; })}
      </ul>
    </section>)}
  </div>;
}
