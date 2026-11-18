import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { catalogCategories, catalogCollection } from "../../../../src/catalog";
import { language } from "../../../../src/domain";
import { hasPublicImage } from "../../../../src/storefront-art";
import { CatalogList } from "../catalog-list";

const banners: Record<string, string> = {
  "fresh-mango-series": "/drinks/hero.webp",
  "creme-brulee": "/promotions/creme-brulee.webp",
  "house-lemonade": "/promotions/house-lemonade.webp",
};

export async function generateMetadata({ params }: PageProps<"/[lang]/catalog/[collection]">) {
  const { lang, collection } = await params;
  const item = language(lang) ? catalogCollection(collection, lang) : undefined;
  return item ? { title: item.title, description: item.headline } : {};
}

export default async function CollectionPage({ params }: PageProps<"/[lang]/catalog/[collection]">) {
  const { lang, collection } = await params;
  if (!language(lang)) notFound();
  const item = catalogCollection(collection, lang);
  if (!item) notFound();
  const banner = banners[item.id];
  return <section className="wrap catalog-page">
    <Link href={`/${lang}/catalog`}>{lang === "fr" ? "Voir le menu" : "Explore the menu"}</Link>
    <h1>{item.title}</h1>
    <p>{item.headline}</p>
    {banner && hasPublicImage(banner) && <Image className="catalog-banner" src={banner} alt="" width={2400} height={900}/>}
    {item.id === "explore-menu" ? <nav className="catalog-links">
      {catalogCategories.slice(0, 4).map(category =>
        <Link key={category.id} href={`/${lang}/catalog?category=${category.id}`}>{category[lang]}</Link>
      )}
    </nav> : <CatalogList lang={lang} ids={item.products}/>}
  </section>;
}
