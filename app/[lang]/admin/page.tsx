import Link from "next/link";
import { notFound } from "next/navigation";
import { analyticsEnabled } from "../../../src/analytics";
import { database } from "../../../src/db";
import { language, money } from "../../../src/domain";
import { staffRole } from "../../../src/staff";
import { pickupConfiguration } from "../../../src/store-settings";
import { demoMode } from "../../../src/demo-mode";
import { instantAccounts } from "../../../src/account-email";
import { emailMode } from "../../../src/notifications";
import { simulatedPayments, stripeMode } from "../../../src/providers/stripe";
import { walletConfigured } from "../../../src/wallet";
import { prepareDemo } from "./demo/actions";
import { BlockerList } from "./blockers";
import { adminItems } from "./nav";

export const metadata = { robots: { index: false, follow: false } };

const blurbs: Record<string, [string, string]> = {
  orders: ["Historique, recherche, annulations et remboursements.", "History, search, cancellations and refunds."],
  notifications: ["Courriels générés, aperçus et statut d’envoi.", "Generated emails, previews and delivery status."],
  wallet: ["Code QR de la carte, Apple Wallet et diagnostics.", "Card QR, Apple Wallet and diagnostics."],
  activity: ["Qui a modifié quoi, et quand.", "Who changed what, and when."],
  catalog: ["Produits, catégories, garnitures, images et collections.", "Products, categories, toppings, images and collections."],
  prices: ["Prix des 62 produits et ce qui est offert.", "Prices for the 62 products and what is offered."],
  hours: ["Heures d’ouverture, fermetures, délai de préparation, capacité.", "Opening hours, closures, lead time, capacity."],
  business: ["Adresse, téléphone, numéros de TPS/TVQ et statut fiscal.", "Address, phone, GST/QST numbers and tax status."],
  customers: ["Liste des clients, tampons et commandes.", "Customer list, stamps and orders."],
  rewards: ["Règles du programme, récompenses, ajustements, remboursements.", "Program rules, rewards, adjustments, refunds."],
  analytics: ["Activité du site : fiches vues, paniers, commandes.", "Site activity: product views, carts, orders."],
  campaigns: ["Campagnes de la page d’accueil et prix rapides.", "Homepage campaigns and quick pricing."],
  team: ["Créer des comptes équipe/admin et gérer les accès.", "Create staff/admin accounts and manage access."],
};

export default async function AdminHome({ params, searchParams }: PageProps<"/[lang]/admin">) {
  const { lang } = await params;
  const demoReady = (await searchParams).demo === "ready";
  if (!language(lang) || !process.env.DATABASE_URL || await staffRole() !== "ADMIN") notFound();
  const fr = lang === "fr";
  const db = await database();
  const [{ blockers }, health, stats] = await Promise.all([pickupConfiguration(), db.query<{ received: number; waiting: number; preparing: number; ready: number; refunds: number; failed_mail: number; stale: number }>(`
    SELECT count(*) FILTER (WHERE status = 'RECEIVED')::int AS received, count(*) FILTER (WHERE status = 'CONFIRMED')::int AS waiting, count(*) FILTER (WHERE status = 'PREPARING')::int AS preparing,
      count(*) FILTER (WHERE status = 'READY')::int AS ready, count(*) FILTER (WHERE payment = 'REFUND_REQUIRED')::int AS refunds,
      (SELECT count(*) FROM email_outbox WHERE status = 'FAILED')::int AS failed_mail,
      count(*) FILTER (WHERE status = 'RECEIVED' AND created_at < now() - interval '10 minutes')::int AS stale
    FROM orders WHERE created_at > now() - interval '3 days' OR status NOT IN ('COMPLETED', 'CANCELLED')`), db.query<{ day: boolean; channel: string; n: number; total: number }>(`
    SELECT created_at >= date_trunc('day', now() AT TIME ZONE 'America/Toronto') AT TIME ZONE 'America/Toronto' AS day, channel, count(*)::int AS n, coalesce(sum(total), 0)::int AS total
    FROM orders WHERE status <> 'CANCELLED' AND created_at >= now() - interval '7 days' AND payment <> 'DEMO_PAID'
    GROUP BY 1, 2`)]);
  const [state] = health.rows;
  const attention = [
    state.stale > 0 && { text: `${state.stale} order(s) waiting more than 10 minutes to be confirmed`, href: `/${lang}/staff?status=RECEIVED` },
    state.refunds > 0 && { text: `${state.refunds} cancelled paid order(s) need a refund`, href: `/${lang}/admin/orders?payment=REFUND_REQUIRED` },
    state.failed_mail > 0 && { text: `${state.failed_mail} email(s) failed to send`, href: `/${lang}/admin/notifications?status=FAILED` },
  ].filter(Boolean) as { text: string; href: string }[];
  const system = [
    ["Payments", simulatedPayments() ? "simulated (Stripe not connected)" : stripeMode()],
    ["Email", emailMode() === "disabled" ? "not connected: recorded, not sent" : emailMode()],
    ["Apple Wallet", walletConfigured() ? "configured" : "not connected"],
    ["Demo mode", demoMode() ? "on" : "off"],
    ["Customer sign-up without email", instantAccounts() ? "ON: remove for launch" : "off"],
  ];
  const sum = (filter: (row: (typeof stats.rows)[number]) => boolean) => stats.rows.filter(filter).reduce((acc, row) => ({ n: acc.n + row.n, total: acc.total + row.total }), { n: 0, total: 0 });
  const cards = [
    { label: fr ? "Aujourd’hui" : "Today", ...sum(row => row.day) },
    { label: fr ? "7 jours · en ligne" : "7 days · online", ...sum(row => row.channel === "ONLINE") },
    { label: fr ? "7 jours · comptoir" : "7 days · counter", ...sum(row => row.channel === "COUNTER") },
  ];
  return <section className="wrap catalog-page">
    <h1>{fr ? "Administration" : "Administration"}</h1>
    {demoReady && <p role="status" className="panel">Demo settings applied: ordering is open, every priced product is offered and the Rewards program is active.</p>}
    {demoMode() && <form action={prepareDemo.bind(null, lang)} className="panel"><h2>Demo store</h2><p>One click opens the test store: Mon–Sat 10:30–20:00 pickup, 10 min lead time, 10 orders per slot, tax status “not registered” (no tax), every priced product offered, Salut Rewards 9+1 active (earning and redemption) with your authorization recorded. Prices are not changed; nothing is charged or sent.</p><button className="button">Apply demo settings</button></form>}
    {blockers.length ? <BlockerList lang={lang} blockers={blockers}/> : <p role="status" className="panel">{fr ? "La commande en ligne pour cueillette est ouverte." : "Online pickup ordering is open."}</p>}
    <div className="console-stats" aria-label={fr ? "Ventes" : "Sales"}>
      {cards.map(card => <div className="panel" key={card.label}><small>{card.label}</small><strong>{money(card.total, lang)}</strong><span>{card.n} {fr ? "commandes (annulées exclues)" : "orders (cancelled excluded)"}</span></div>)}
    </div>
    <div className="console-stats" aria-label="Orders in progress">
      {([["New", state.received], ["Confirmed", state.waiting], ["Preparing", state.preparing], ["Ready", state.ready]] as const).map(([label, n]) => <div className="panel" key={label}><small>{label}</small><strong>{n}</strong><span><Link href={`/${lang}/staff`}>Open live queue</Link></span></div>)}
    </div>
    <div className="panel"><h2>Needs attention</h2>{attention.length ? <ul>{attention.map(item => <li key={item.text}><Link href={item.href}>{item.text}</Link></li>)}</ul> : <p>Nothing needs attention.</p>}</div>
    <div className="panel"><h2>System status</h2><ul>{system.map(([label, value]) => <li key={label}>{label}: <strong>{value}</strong></li>)}</ul></div>
    <h2>{fr ? "Tout gérer d’ici" : "Manage everything from here"}</h2>
    <ul className="catalog-grid">
      {adminItems.filter(item => item.id !== "home" && item.id !== "counter").map(item => <li key={item.id}>
        <Link href={`/${lang}${item.path}`}><strong>{item.label[fr ? 0 : 1]}</strong></Link>
        <small>{blurbs[item.id][fr ? 0 : 1]}</small>
        {item.id === "analytics" && !analyticsEnabled() && <small>{fr ? "Mesure désactivée pour le moment." : "Measurement is currently off."}</small>}
      </li>)}
      <li><Link href={`/${lang}/staff/counter`}><strong>{fr ? "Vente au comptoir" : "Counter sale"}</strong></Link><small>{fr ? "Enregistrer une vente en personne." : "Record an in-person sale."}</small></li>
      <li><Link href={`/${lang}/staff/rewards`}><strong>{fr ? "Scanner une carte" : "Scan a card"}</strong></Link><small>{fr ? "Identifier un client et échanger une boisson gratuite." : "Identify a customer and redeem a free drink."}</small></li>
    </ul>
  </section>;
}
