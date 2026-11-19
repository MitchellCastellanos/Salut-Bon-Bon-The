import Link from "next/link";
import { notFound } from "next/navigation";
import { analyticsEnabled } from "../../../src/analytics";
import { database } from "../../../src/db";
import { language, money } from "../../../src/domain";
import { staffRole } from "../../../src/staff";
import { pickupConfiguration } from "../../../src/store-settings";
import { BlockerList } from "./blockers";
import { adminItems } from "./nav";

export const metadata = { robots: { index: false, follow: false } };

const blurbs: Record<string, [string, string]> = {
  orders: ["Suivre et faire avancer les commandes ; enregistrer une vente au comptoir.", "Follow and advance orders; record a counter sale."],
  catalog: ["Produits, catégories, garnitures, images et collections.", "Products, categories, toppings, images and collections."],
  prices: ["Prix des 62 produits et ce qui est offert.", "Prices for the 62 products and what is offered."],
  hours: ["Heures d’ouverture, fermetures, délai de préparation, capacité.", "Opening hours, closures, lead time, capacity."],
  business: ["Adresse, téléphone, numéros de TPS/TVQ et statut fiscal.", "Address, phone, GST/QST numbers and tax status."],
  customers: ["Liste des clients, points et commandes.", "Customer list, points and orders."],
  rewards: ["Règles du programme, récompenses, ajustements, remboursements.", "Program rules, rewards, adjustments, refunds."],
  analytics: ["Activité du site : fiches vues, paniers, commandes.", "Site activity: product views, carts, orders."],
  campaigns: ["Campagnes de la page d’accueil et prix rapides.", "Homepage campaigns and quick pricing."],
  team: ["Créer des comptes équipe/admin et gérer les accès.", "Create staff/admin accounts and manage access."],
};

export default async function AdminHome({ params }: PageProps<"/[lang]/admin">) {
  const { lang } = await params;
  if (!language(lang) || !process.env.DATABASE_URL || await staffRole() !== "ADMIN") notFound();
  const fr = lang === "fr";
  const db = await database();
  const [{ blockers }, stats] = await Promise.all([pickupConfiguration(), db.query<{ day: boolean; channel: string; n: number; total: number }>(`
    SELECT created_at >= date_trunc('day', now() AT TIME ZONE 'America/Toronto') AT TIME ZONE 'America/Toronto' AS day, channel, count(*)::int AS n, coalesce(sum(total), 0)::int AS total
    FROM orders WHERE status <> 'CANCELLED' AND created_at >= now() - interval '7 days' AND payment <> 'DEMO_PAID'
    GROUP BY 1, 2`)]);
  const sum = (filter: (row: (typeof stats.rows)[number]) => boolean) => stats.rows.filter(filter).reduce((acc, row) => ({ n: acc.n + row.n, total: acc.total + row.total }), { n: 0, total: 0 });
  const cards = [
    { label: fr ? "Aujourd’hui" : "Today", ...sum(row => row.day) },
    { label: fr ? "7 jours · en ligne" : "7 days · online", ...sum(row => row.channel === "ONLINE") },
    { label: fr ? "7 jours · comptoir" : "7 days · counter", ...sum(row => row.channel === "COUNTER") },
  ];
  return <section className="wrap catalog-page">
    <h1>{fr ? "Administration" : "Administration"}</h1>
    {blockers.length ? <BlockerList lang={lang} blockers={blockers}/> : <p role="status" className="panel">{fr ? "La commande en ligne pour cueillette est ouverte." : "Online pickup ordering is open."}</p>}
    <div className="console-stats" aria-label={fr ? "Ventes" : "Sales"}>
      {cards.map(card => <div className="panel" key={card.label}><small>{card.label}</small><strong>{money(card.total, lang)}</strong><span>{card.n} {fr ? "commandes (annulées exclues)" : "orders (cancelled excluded)"}</span></div>)}
    </div>
    <h2>{fr ? "Tout gérer d’ici" : "Manage everything from here"}</h2>
    <ul className="catalog-grid">
      {adminItems.filter(item => item.id !== "home" && item.id !== "counter").map(item => <li key={item.id}>
        <Link href={`/${lang}${item.path}`}><strong>{item.label[fr ? 0 : 1]}</strong></Link>
        <small>{blurbs[item.id][fr ? 0 : 1]}</small>
        {item.id === "analytics" && !analyticsEnabled() && <small>{fr ? "Mesure désactivée pour le moment." : "Measurement is currently off."}</small>}
      </li>)}
      <li><Link href={`/${lang}/staff/counter`}><strong>{fr ? "Vente au comptoir" : "Counter sale"}</strong></Link><small>{fr ? "Enregistrer une vente en personne." : "Record an in-person sale."}</small></li>
      <li><Link href={`/${lang}/staff/rewards`}><strong>{fr ? "Scanner une carte" : "Scan a card"}</strong></Link><small>{fr ? "Identifier un client et échanger des points." : "Identify a customer and redeem points."}</small></li>
    </ul>
  </section>;
}
