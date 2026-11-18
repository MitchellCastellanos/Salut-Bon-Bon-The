import { notFound } from "next/navigation";
import { categories, language, products } from "../../../src/domain";
import { Drink } from "../../../src/drink";
import { Menu } from "./menu";

export async function generateMetadata({ params }: PageProps<"/[lang]/menu">) {
  const { lang } = await params;
  return { title: "Menu", ...(process.env.SITE_URL ? { alternates: { canonical: `/${lang}/menu`, languages: { "fr-CA": "/fr/menu", "en-CA": "/en/menu" } } } : {}) };
}
export default async function MenuPage({ params, searchParams }: PageProps<"/[lang]/menu">) {
  const { lang } = await params;
  if (!language(lang)) notFound();
  const { category } = await searchParams;
  const initialCategory = typeof category === "string" && Object.hasOwn(categories, category) ? category as keyof typeof categories : "all";
  return <div className="wrap section">
    <p className="eyebrow">{lang === "fr" ? "MENU DE DÉMONSTRATION" : "DEMO MENU"}</p><h1>Menu<span>.</span></h1>
    <Menu key={initialCategory} initialCategory={initialCategory} lang={lang} demo={!process.env.DATABASE_URL} photos={Object.fromEntries(products.map(p => [p.id, <Drink key={p.id} flavor={p.color}/>]))}/>
  </div>;
}
