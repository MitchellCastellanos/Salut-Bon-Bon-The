import { officialLogo } from "../../../src/brand-server";
import { cardPaymentsEnabled } from "../../../src/providers/stripe";
import { pickupConfiguration } from "../../../src/store-settings";
import { Menu } from "../menu/menu";
import { officialPrices } from "../../../src/catalog-pricing";
import { displayedCatalogPrices } from "../../../src/catalog-display-prices";
import Link from "next/link";
import { notFound } from "next/navigation";
import Image from "next/image";
import { catalogCategories, catalogCollections, catalogProducts } from "../../../src/catalog";
import { hasPublicImage, StorefrontIcon } from "../../../src/storefront-art";
import { language } from "../../../src/domain";
import { CatalogList } from "./catalog-list";
import { customerSession } from "../../../src/customer";
import { currentGuestCard } from "../../../src/guest-card";
import { loyaltyProgram, programStages } from "../../../src/loyalty";
import { cardPath, rewardsPath } from "../../../src/rewards-paths";

export default async function CatalogPage({ params, searchParams }: PageProps<"/[lang]/catalog">) {
  const { lang } = await params;
  if (!language(lang)) notFound();
  const { category, q, customize } = await searchParams;
  const selected = typeof category === "string" ? category : "";
  const search = typeof q === "string" ? q.slice(0, 100) : "";
  const config = process.env.DATABASE_URL ? await pickupConfiguration() : null;
  const prices = config?.enabled ? await officialPrices() : [];
  const [categories, collections, products] = await Promise.all([catalogCategories(), catalogCollections(), catalogProducts()]);
  const normalize = (value: string) => value.toLocaleLowerCase(lang).normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const query = normalize(search.trim());
  const byId = new Map(products.map(item => [item.id, item]));
  // One list: the same cards browse and order. Filters narrow it; "Customize" opens the options right on the card.
  const orderable = [...new Set(prices.map(row => row.id))].map(id => {
    const variants = prices.filter(row => row.id === id);
    return {
      id, category: byId.get(id)?.category ?? "", name: { fr: variants[0].fr, en: variants[0].en },
      topping: ["none" as const], groups: variants[0].groups,
      prices: Object.fromEntries(variants.map(row => [row.size, row.cents])),
    };
  });
  // Sold-out drinks (published but not available) stay in the list, marked unavailable, as the ADMIN decided.
  const listing = products.flatMap(item => {
    const priced = orderable.find(entry => entry.id === item.id);
    return priced ? [priced] : item.available ? [] : [{ id: item.id, category: item.category, name: { fr: item.fr, en: item.en }, topping: ["none" as const], groups: [], prices: {}, soldOut: true }];
  });
  const visible = listing.filter(item => (!selected || item.category === selected) && [item.name.fr, item.name.en, item.id].some(value => normalize(value).includes(query)));
  const fr = lang === "fr";
  const displayRows = await displayedCatalogPrices();
  const demoPrices = Object.fromEntries(displayRows.filter(row => row.size === "regular").map(row => [row.id, { cents: row.cents, approved: true }]));
  // Cart rewards hint: only with a configured, publicly visible program. Reading failures simply hide the hint.
  const program = process.env.DATABASE_URL ? await loyaltyProgram().catch(() => undefined) : undefined;
  const linked = program ? Boolean(await customerSession().catch(() => undefined) || await currentGuestCard().catch(() => undefined)) : false;
  const rewardsInfo = program?.previewVisible ? {
    operational: programStages(program).accrualOperational, allEligible: !program.earnCategories?.length,
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
    {orderable.length === 0 ? <CatalogList lang={lang} category={selected} search={search} previewPrices={demoPrices} browseOnly/> : <section aria-labelledby="orderable">
      <h2 id="orderable" className="catalog-count">{visible.length} {fr ? `boisson${visible.length > 1 ? "s" : ""} · touche Personnaliser pour l’ajouter à ton panier` : `drink${visible.length === 1 ? "" : "s"} · tap Customize to add one to your cart`}</h2>
      <Menu lang={lang} demo={false} rewards={rewardsInfo} openProduct={typeof customize === "string" ? customize : undefined} cartHref={`/${lang}/catalog#cart`} photos={Object.fromEntries(products.map(item => [item.id, item.image && hasPublicImage(item.image) ? <div className="product-photo" key={item.id}><Image src={item.image} alt="" width={1200} height={1140} sizes="(max-width: 760px) 46vw, 240px"/></div> : <span className="catalog-fallback" key={item.id}><StorefrontIcon name={item.category === "matcha" ? "matcha" : item.category === "smoothies" ? "smoothie" : item.category === "lemonade" ? "lemonade" : item.category === "fruit-tea" ? "fruit" : "milk"}/></span>]))} initialCategory="all" officialProducts={typeof customize === "string" && !visible.some(item => item.id === customize) ? [...visible, ...orderable.filter(item => item.id === customize)] : visible} taxRates={config?.taxRates ?? []} pickupInfo={config?.profile ?? undefined} cardPayments={cardPaymentsEnabled()} logo={officialLogo()}/>
      {visible.length === 0 && <p>{fr ? "Aucun résultat." : "No results."}</p>}
    </section>}
  </section>;
}
