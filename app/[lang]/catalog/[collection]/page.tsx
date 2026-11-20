import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { catalogCategories, catalogCollection } from "../../../../src/catalog";
import { language } from "../../../../src/domain";
import { hasPublicImage } from "../../../../src/storefront-art";
import { CatalogList } from "../catalog-list";
import { RestoreCatalogPosition } from "../restore-position";

export async function generateMetadata({ params }: PageProps<"/[lang]/catalog/[collection]">) {
  const { lang, collection } = await params;
  const item = language(lang) ? await catalogCollection(collection, lang) : undefined;
  return item ? { title: item.title, description: item.seo ?? item.headline } : {};
}

export default async function CollectionPage({ params }: PageProps<"/[lang]/catalog/[collection]">) {
  const { lang, collection } = await params;
  if (!language(lang)) notFound();
  const item = await catalogCollection(collection, lang);
  if (!item) notFound();
  const banner = item.image;
  const categories = item.id === "explore-menu" ? await catalogCategories() : [];
  return <section className="wrap catalog-page">
    <RestoreCatalogPosition />
    <Link className="outline" href={`/${lang}/catalog`}>← {lang === "fr" ? "Retour au catalogue" : "Back to catalog"}</Link>
    <h1>{item.title}</h1>
    <p>{item.headline}</p>
    {banner && hasPublicImage(banner) && <Image className="catalog-banner" src={banner} alt="" width={2400} height={900}/>}
    {item.id === "explore-menu" ? <nav className="catalog-links">
      {categories.slice(0, 4).map(category =>
        <Link key={category.id} href={`/${lang}/catalog?category=${category.id}`}>{category[lang]}</Link>
      )}
    </nav> : <CatalogList lang={lang} ids={item.products}/>}
  </section>;
}
