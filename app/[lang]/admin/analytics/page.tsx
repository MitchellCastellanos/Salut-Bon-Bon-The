import { notFound } from "next/navigation";
import { analyticsEnabled } from "../../../../src/analytics";
import { database } from "../../../../src/db";
import { language } from "../../../../src/domain";
import { staffRole } from "../../../../src/staff";

export const metadata = { robots: { index: false, follow: false } };

export default async function AnalyticsPage({ params, searchParams }: PageProps<"/[lang]/admin/analytics">) {
  const { lang } = await params;
  if (!language(lang) || !process.env.DATABASE_URL || await staffRole() !== "ADMIN") notFound();
  const enabled = analyticsEnabled();
  const { period } = await searchParams;
  const days = period === "7" ? 7 : period === "90" ? 90 : 30;
  const { rows } = enabled ? await (await database()).query<{ event: string; campaign_id: string | null; total: number }>(`
    SELECT event, campaign_id, count(*)::int AS total
    FROM marketing_events WHERE occurred_at >= now() - ($1::int * interval '1 day')
    GROUP BY event, campaign_id ORDER BY total DESC, event, campaign_id
  `, [days]) : { rows: [] };
  const fr = lang === "fr";
  const maximum = Math.max(1, ...rows.map(row => row.total));
  const number = new Intl.NumberFormat(fr ? "fr-CA" : "en-CA");
  const labels: Record<string, [string, string]> = {
    page_view: ["Pages vues", "Page views"],
    hero_impression: ["Affichages de la bannière", "Hero impressions"],
    hero_click: ["Clics sur la bannière", "Hero clicks"],
    campaign_click: ["Clics de campagne", "Campaign clicks"],
    collection_visit: ["Visites des collections", "Collection visits"],
    category_click: ["Clics de catégorie", "Category clicks"],
    product_view: ["Fiches produit vues", "Product views"],
    add_to_cart: ["Ajouts au panier", "Additions to cart"],
    checkout_start: ["Commandes commencées", "Checkout starts"],
    completed_order: ["Commandes passées", "Orders placed"],
  };
  return <section className="wrap catalog-page">
    <h1>{fr ? "Mesure d’audience" : "Audience analytics"}</h1>
    {!enabled && <p role="status" className="panel">{fr ? "La mesure d’audience est désactivée (SALUT_ANALYTICS_ENABLED). Quand elle sera activée, seuls les visiteurs qui acceptent le témoin sont mesurés, sans données personnelles." : "Audience measurement is switched off (SALUT_ANALYTICS_ENABLED). Once on, only visitors who accept the cookie are measured, with no personal data."}</p>}
    <form className="catalog-filters">
      <label>{fr ? "Période" : "Period"} <select name="period" defaultValue={days}>
        {[7, 30, 90].map(value => <option key={value} value={value}>{value} {fr ? "jours" : "days"}</option>)}
      </select></label>
      <button className="outline">{fr ? "Appliquer" : "Apply"}</button>
    </form>
    {!rows.length && <p>{fr ? "Aucune activité pour cette période." : "No activity in this period."}</p>}
    <ul className="catalog-grid">
      {rows.map(row => <li key={`${row.event}:${row.campaign_id ?? ""}`} title={number.format(row.total)}>
        <strong>{labels[row.event]?.[fr ? 0 : 1] ?? row.event}</strong>
        {row.campaign_id && <small>{row.campaign_id}</small>}
        <meter min={0} max={maximum} value={row.total} aria-label={number.format(row.total)}/>
        <span>{number.format(row.total)}</span>
      </li>)}
    </ul>
  </section>;
}
