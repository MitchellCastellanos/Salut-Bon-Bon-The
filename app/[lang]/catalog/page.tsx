import { officialLogo } from "../../../src/brand-server";
import { cardPaymentsEnabled } from "../../../src/providers/stripe";
import { pickupConfiguration } from "../../../src/store-settings";
import { Menu } from "../menu/menu";
import { officialPrices } from "../../../src/catalog-pricing";
import Link from "next/link";
import { notFound } from "next/navigation";
import { catalogCategories, catalogCollections } from "../../../src/catalog";
import { language } from "../../../src/domain";
import { CatalogList } from "./catalog-list";

export default async function CatalogPage({ params, searchParams }: PageProps<"/[lang]/catalog">) {
  const { lang } = await params;
  if (!language(lang)) notFound();
  const { category, q } = await searchParams;
  const selected = typeof category === "string" ? category : "";
  const search = typeof q === "string" ? q.slice(0, 100) : "";
  const config = process.env.DATABASE_URL ? await pickupConfiguration() : null;
  const prices = config?.enabled ? await officialPrices() : [];
  const orderable = [...new Set(prices.map(row => row.id))].map(id => {
    const variants = prices.filter(row => row.id === id);
    return {
      id, category: "", name: { fr: variants[0].fr, en: variants[0].en },
      topping: ["none" as const], groups: variants[0].groups,
      prices: Object.fromEntries(variants.map(row => [row.size, row.cents])),
    };
  });
  const [categories, collections] = await Promise.all([catalogCategories(), catalogCollections()]);
  const fr = lang === "fr";
  return <section className="wrap catalog-page">
    <h1>{fr ? "Notre menu" : "Our menu"}</h1>
    {!orderable.length && <p role="status">{fr ? "La commande en ligne est indisponible pour le moment : les prix ou les heures de cueillette ne sont pas encore publiés par l’équipe. Vous pouvez parcourir tout le menu ci-dessous." : "Online ordering is unavailable right now: prices or pickup hours have not been published by the team yet. You can browse the full menu below."}</p>}
    <nav className="catalog-links" aria-label={fr ? "Collections" : "Collections"}>
      {collections.map(item => <Link key={item.id} href={`/${lang}/catalog/${item.id}`}>{item[lang]}</Link>)}
    </nav>
    <form className="catalog-filters">
      <label>{fr ? "Rechercher" : "Search"} <input type="search" name="q" defaultValue={search} maxLength={100}/></label>
      <label>{fr ? "Catégorie" : "Category"} <select name="category" defaultValue={selected}>
        <option value="">{fr ? "Toutes" : "All categories"}</option>
        {categories.map(item => <option key={item.id} value={item.id}>{item[lang]}</option>)}
      </select></label>
      <button className="button">{fr ? "Filtrer" : "Filter"}</button>
    </form>
    <CatalogList lang={lang} category={selected} search={search}/>
    {orderable.length > 0 && <section aria-labelledby="orderable">
      <h2 id="orderable">{fr ? "Disponibles pour la cueillette" : "Available for pickup"}</h2>
      <Menu lang={lang} demo={false} photos={{}} initialCategory="all" officialProducts={orderable} taxRates={config?.policy?.taxRates ?? []} cardPayments={cardPaymentsEnabled()} logo={officialLogo()}/>
    </section>}
  </section>;
}
