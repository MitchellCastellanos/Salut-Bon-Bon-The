import { officialLogo } from "../../../src/brand-server";
import { cardPaymentsEnabled } from "../../../src/providers/stripe";
import { pickupConfiguration } from "../../../src/store-settings";
import { Menu } from "../menu/menu";
import { officialPrices } from "../../../src/catalog-pricing";
import { database } from "../../../src/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import Image from "next/image";
import { catalogCategories, catalogCollections, catalogProducts } from "../../../src/catalog";
import { hasPublicImage } from "../../../src/storefront-art";
import { language } from "../../../src/domain";
import { CatalogList } from "./catalog-list";
import { customerSession } from "../../../src/customer";
import { currentGuestCard } from "../../../src/guest-card";
import { loyaltyProgram, programStages } from "../../../src/loyalty";
import { cardPath, rewardsPath } from "../../../src/rewards-paths";

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
  const [categories, collections, products] = await Promise.all([catalogCategories(), catalogCollections(), catalogProducts()]);
  const fr = lang === "fr";
  const demoPriceRows = process.env.DATABASE_URL ? await (await database()).query<{ product_id: string; price_cents: number; approved: boolean }>(`SELECT product_id, price_cents, approved FROM catalog_variants WHERE id = 'regular' AND price_cents IS NOT NULL`).then(result => result.rows) : [];
  const demoPrices = Object.fromEntries(demoPriceRows.map(row => [row.product_id, { cents: row.price_cents, approved: row.approved }]));
  // Cart rewards hint: only with a configured, publicly visible program. Reading failures simply hide the hint.
  const program = process.env.DATABASE_URL ? await loyaltyProgram().catch(() => undefined) : undefined;
  const linked = program ? Boolean(await customerSession().catch(() => undefined) || await currentGuestCard().catch(() => undefined)) : false;
  const rewardsInfo = program?.previewVisible && program.pointsPerDollar ? {
    pointsPerDollar: program.pointsPerDollar, operational: programStages(program).accrualOperational, allEligible: !program.earnCategories?.length,
    minOrderCents: program.minOrderCents, linked, rewardsHref: rewardsPath[lang], cardHref: cardPath[lang], accountHref: `/${lang}/account` } : undefined;
  return <section className="wrap catalog-page">
    <h1>{fr ? "Notre menu" : "Our menu"}</h1>
    
    <nav className="catalog-links" aria-label={fr ? "Collections" : "Collections"}>
      {collections.map(item => <Link key={item.id} href={`/${lang}/catalog/${item.id}`}>{item[lang]}</Link>)}
    </nav>
    <form className="catalog-filters" role="search" aria-label={fr ? "Trouver une boisson" : "Find a drink"}>
      <label className="catalog-search-field"><span className="catalog-filter-label">{fr ? "Rechercher une boisson" : "Find a drink"}</span><input type="search" name="q" defaultValue={search} maxLength={100} placeholder={fr ? "Nom, saveur..." : "Name, flavour..."}/></label>
      <label className="catalog-category-field"><span className="catalog-filter-label">{fr ? "Catégorie" : "Category"}</span><select name="category" defaultValue={selected}>
        <option value="">{fr ? "Toutes" : "All categories"}</option>
        {categories.map(item => <option key={item.id} value={item.id}>{item[lang]}</option>)}
      </select></label>
      <button className="button catalog-filter-submit">{fr ? "Afficher" : "Show"}</button>
    </form>
    <CatalogList lang={lang} category={selected} search={search} previewPrices={demoPrices}/>
    {orderable.length > 0 && <section aria-labelledby="orderable">
      <h2 id="orderable">{fr ? "Disponibles pour la cueillette" : "Available for pickup"}</h2>
      <Menu lang={lang} demo={false} rewards={rewardsInfo} photos={Object.fromEntries(products.filter(item => item.image && hasPublicImage(item.image)).map(item => [item.id, <div className="product-photo" key={item.id}><Image src={item.image!} alt="" width={1200} height={1140} sizes="(max-width: 760px) 46vw, 240px"/></div>]))} initialCategory="all" officialProducts={orderable} taxRates={config?.taxRates ?? []} pickupInfo={config?.profile ?? undefined} cardPayments={cardPaymentsEnabled()} logo={officialLogo()}/>
    </section>}
  </section>;
}
