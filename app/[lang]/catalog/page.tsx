import Link from "next/link";
import { notFound } from "next/navigation";
import { catalogCategories, catalogCollections } from "../../../src/catalog";
import { language } from "../../../src/domain";
import { CatalogList } from "./catalog-list";
import { RestoreCatalogPosition } from "./restore-position";
export default async function CatalogPage({ params, searchParams }: PageProps<"/[lang]/catalog">) {
  const { lang } = await params;
  if (!language(lang)) notFound();
  const { category, q } = await searchParams;
  const selected = typeof category === "string" ? category : "";
  const search = typeof q === "string" ? q.slice(0, 100) : "";
  const [categories, collections] = await Promise.all([catalogCategories(), catalogCollections()]);
  const fr = lang === "fr";
  const displayRows = await displayedCatalogPrices();
  const demoPrices = Object.fromEntries(displayRows.filter(row => row.size === "regular").map(row => [row.id, { cents: row.cents, approved: true }]));
  return <section className="wrap catalog-page">
    <RestoreCatalogPosition />
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
  </section>;
}
