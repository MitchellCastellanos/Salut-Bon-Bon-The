import Link from "next/link";
import { notFound } from "next/navigation";
import { catalogCategories, catalogProducts } from "../../../../../src/catalog";
import { officialPrices } from "../../../../../src/catalog-pricing";
import { language, modifiers, money } from "../../../../../src/domain";

export default async function ProductPage({ params }: PageProps<"/[lang]/catalog/products/[id]">) {
  const { lang, id } = await params;
  if (!language(lang)) notFound();
  const product = (await catalogProducts()).find(item => item.id === id);
  if (!product) notFound();
  const category = catalogCategories.find(item => item.id === product.category);
  const variants = process.env.DATABASE_URL ? (await officialPrices()).filter(row => row.id === id) : [];
  const fr = lang === "fr";
  return <section className="wrap catalog-page">
    <Link href={`/${lang}/catalog?category=${product.category}`}>{category?.[lang]}</Link>
    <h1>{product[lang]}</h1>
    {variants.length ? <>
      <ul>{variants.map(row => <li key={row.size}>{modifiers[row.size][lang]} · {money(row.cents, lang)}</li>)}</ul>
      <Link className="button" href={`/${lang}/catalog#order-${id}`}>{fr ? "Personnaliser pour la cueillette" : "Customize for pickup"}</Link>
    </> : <p>{fr ? "Indisponible pour la commande en ligne." : "Unavailable for online ordering."}</p>}
  </section>;
}
