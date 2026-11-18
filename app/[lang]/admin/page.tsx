import { analyticsEnabled } from "../../../src/analytics";
import Link from "next/link";
import { notFound } from "next/navigation";
import { database } from "../../../src/db";
import { language, modifiers } from "../../../src/domain";
import { staffRole } from "../../../src/staff";
import { saveAvailability, saveBulkPricing, saveCampaign, savePricing } from "./actions";

export const metadata = { robots: { index: false, follow: false } };

export default async function AdminPage({ params }: PageProps<"/[lang]/admin">) {
  const { lang } = await params;
  if (!language(lang) || !process.env.DATABASE_URL || await staffRole() !== "ADMIN") notFound();
  const fr = lang === "fr";
  const db = await database();
  const { rows } = await db.query<{
    id: string; name: string; available: boolean; size: "regular" | "large";
    price_cents: number | null; promotional_cents: number | null;
    approved: boolean | null; variant_available: boolean | null;
  }>(`
    SELECT p.id, t.name, p.available, s.size, v.price_cents, v.promotional_cents,
           v.approved, v.available AS variant_available
    FROM catalog_products p
    JOIN catalog_product_translations t ON t.product_id = p.id AND t.locale = $1
    CROSS JOIN (VALUES ('regular'), ('large')) AS s(size)
    LEFT JOIN catalog_variants v ON v.product_id = p.id AND v.id = s.size
    ORDER BY p.id, s.size DESC
  `, [lang]);
  const { rows: campaigns } = await db.query<{
    id: string; published: boolean; active: boolean; starts_at: Date | string | null; ends_at: Date | string | null;
    homepage_position: number | null; headline_fr: string; headline_en: string; seo_fr: string | null; seo_en: string | null; image: string | null;
  }>(`
    SELECT c.*, fr.headline AS headline_fr, en.headline AS headline_en,
      fr.seo_description AS seo_fr, en.seo_description AS seo_en, a.path AS image
    FROM marketing_campaigns c
    JOIN marketing_campaign_translations fr ON fr.campaign_id = c.id AND fr.locale = 'fr'
    JOIN marketing_campaign_translations en ON en.campaign_id = c.id AND en.locale = 'en'
    LEFT JOIN LATERAL (SELECT path FROM marketing_campaign_assets WHERE campaign_id = c.id ORDER BY path LIMIT 1) a ON true
    ORDER BY c.homepage_position, c.id
  `);
  const iso = (value: Date | string | null) => value ? new Date(value).toISOString() : "";
  return <section className="wrap catalog-page">
    <Link href={`/${lang}/staff`}>{fr ? "Commandes" : "Orders"}</Link>
    <p><Link href={`/${lang}/admin/catalog`}>{fr ? "Modifier le catalogue" : "Edit the catalog"}</Link></p>
    {analyticsEnabled() && <p><Link href={`/${lang}/admin/analytics`}>{fr ? "Mesure d’audience" : "Audience analytics"}</Link></p>}
    <h1>{fr ? "Prix et disponibilité" : "Pricing and availability"}</h1>
    <p>{fr ? "Saisissez les prix en cents canadiens." : "Enter prices in Canadian cents."}</p>
    <nav className="panel" aria-label={fr ? "Outils d’administration" : "Admin tools"}>
      <Link href={`/${lang}/admin/prices`}>{fr ? "Feuille de prix (tous les produits)" : "Price sheet (all products)"}</Link>{" · "}
      <Link href={`/${lang}/admin/business`}>{fr ? "Commerce et fiscalité" : "Business and tax"}</Link>{" · "}
      <Link href={`/${lang}/admin/hours`}>{fr ? "Heures, cueillette et fermetures" : "Hours, pickup and closures"}</Link>{" · "}
      <Link href={`/${lang}/admin/rewards`}>{fr ? "Récompenses Salut" : "Salut Rewards"}</Link>{" · "}
      <Link href={`/${lang}/staff/rewards`}>{fr ? "Scanner une carte" : "Scan a card"}</Link>
    </nav>
    <details className="panel">
      <summary>{fr ? "Importer des prix en lot" : "Import prices in bulk"}</summary>
      <form className="checkout" action={saveBulkPricing}>
        <label>{fr ? "Tableau JSON des formats à mettre à jour" : "JSON array of variants to update"}
          <textarea name="prices" rows={5} required maxLength={32000} placeholder='[{"id":"401","size":"regular","price":null,"promo":null,"approved":false,"available":false}]'/>
        </label>
        <p>{fr ? "Remplacez null dans price par le prix approuvé en cents. promo peut rester null." : "Replace null in price with the approved price in cents. promo can remain null."}</p>
        <button className="outline">{fr ? "Enregistrer le lot" : "Save batch"}</button>
      </form>
    </details>
    <details className="panel">
      <summary>{fr ? "Campagnes" : "Campaigns"}</summary>
      {campaigns.map(campaign => <form key={campaign.id} action={saveCampaign} className="checkout">
        <h2>{campaign.id}</h2>
        <input type="hidden" name="id" value={campaign.id}/>
        <label>{fr ? "Titre français" : "French headline"}<input name="headlineFr" required maxLength={200} defaultValue={campaign.headline_fr}/></label>
        <label>{fr ? "Titre anglais" : "English headline"}<input name="headlineEn" required maxLength={200} defaultValue={campaign.headline_en}/></label>
        <label>{fr ? "Description SEO française" : "French SEO description"}<input name="seoFr" maxLength={250} defaultValue={campaign.seo_fr ?? ""}/></label>
        <label>{fr ? "Description SEO anglaise" : "English SEO description"}<input name="seoEn" maxLength={250} defaultValue={campaign.seo_en ?? ""}/></label>
        <label>{fr ? "Chemin WebP public" : "Public WebP path"}<input name="image" defaultValue={campaign.image ?? ""}/></label>
        <label>{fr ? "Début (ISO 8601)" : "Start (ISO 8601)"}<input name="starts" defaultValue={iso(campaign.starts_at)} placeholder="YYYY-MM-DDTHH:mm:ssZ"/></label>
        <label>{fr ? "Fin (ISO 8601)" : "End (ISO 8601)"}<input name="ends" defaultValue={iso(campaign.ends_at)} placeholder="YYYY-MM-DDTHH:mm:ssZ"/></label>
        <label>{fr ? "Position sur l’accueil" : "Homepage position"}<input type="number" name="position" min="1" max="99" defaultValue={campaign.homepage_position ?? ""}/></label>
        <label><input type="checkbox" name="published" defaultChecked={campaign.published}/> {fr ? "Publiée" : "Published"}</label>
        <label><input type="checkbox" name="active" defaultChecked={campaign.active}/> {fr ? "Active" : "Active"}</label>
        <button className="outline">{fr ? "Enregistrer la campagne" : "Save campaign"}</button>
      </form>)}
    </details>
    {rows.filter(row => row.size === "regular").map(product => <section className="panel" key={product.id}>
      <h2>{product.name} · {product.id}</h2>
      <form className="catalog-filters" action={saveAvailability}>
        <input type="hidden" name="id" value={product.id}/>
        <label><input type="checkbox" name="available" defaultChecked={product.available}/> {fr ? "Produit disponible" : "Product available"}</label>
        <button className="outline">{fr ? "Enregistrer la disponibilité" : "Save availability"}</button>
      </form>
      {rows.filter(row => row.id === product.id).map(row => <form className="catalog-filters" action={savePricing} key={row.size}>
        <input type="hidden" name="id" value={row.id}/>
        <input type="hidden" name="size" value={row.size}/>
        <strong>{modifiers[row.size][lang]}</strong>
        <label>{fr ? "Prix" : "Price"} <input name="price" type="number" required min="1" max="100000" defaultValue={row.price_cents ?? ""}/></label>
        <label>{fr ? "Prix promotionnel" : "Promotional price"} <input name="promo" type="number" min="1" max="100000" defaultValue={row.promotional_cents ?? ""}/></label>
        <label><input name="approved" type="checkbox" defaultChecked={Boolean(row.approved)}/> {fr ? "Approuvé" : "Approved"}</label>
        <label><input name="available" type="checkbox" defaultChecked={Boolean(row.variant_available)}/> {fr ? "Format disponible" : "Variant available"}</label>
        <button className="outline">{fr ? "Enregistrer le format" : "Save variant"}</button>
      </form>)}
    </section>)}
  </section>;
}
