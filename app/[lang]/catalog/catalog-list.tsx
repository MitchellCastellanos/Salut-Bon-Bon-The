import Image from "next/image";
import { hasPublicImage } from "../../../src/storefront-art";
import Link from "next/link";
import { catalogCategories, catalogProducts } from "../../../src/catalog";
import type { Lang } from "../../../src/domain";

export async function CatalogList({ lang, category, search = "", ids }: {
  lang: Lang;
  category?: string;
  search?: string;
  ids?: string[];
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
      const photo = product.image;
      return <li key={product.id} id={product.id}>
      {photo && hasPublicImage(photo) && <Image className="catalog-banner" src={photo} alt="" width={1200} height={1140}/>}
      <Link href={`/${lang}/catalog/products/${product.id}`}><strong>{product[lang]}</strong></Link>
      <small>{categories.find(item => item.id === product.category)?.[lang]}</small>
      {ids && <Link href={`/${lang}/catalog?category=${product.category}#${product.id}`}>
        {lang === "fr" ? "Voir au menu" : "View on the menu"}
      </Link>}
    </li>; })}
  </ul>;
}
