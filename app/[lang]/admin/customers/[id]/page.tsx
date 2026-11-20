import Link from "next/link";
import { notFound } from "next/navigation";
import { database } from "../../../../../src/db";
import { language, money, pickupDate, stateLabels, type State } from "../../../../../src/domain";
import { accountHistory } from "../../../../../src/loyalty";
import { staffRole } from "../../../../../src/staff";

export const metadata = { robots: { index: false, follow: false } };

export default async function AdminCustomer({ params }: PageProps<"/[lang]/admin/customers/[id]">) {
  const { lang, id } = await params;
  if (!language(lang) || !process.env.DATABASE_URL || await staffRole() !== "ADMIN" || !/^[\w-]{1,64}$/.test(id)) notFound();
  const fr = lang === "fr";
  const db = await database();
  const { rows: [user] } = await db.query<{ id: string; name: string; email: string; created_at: Date | string; verified: boolean }>(
    `SELECT "id", "name", "email", "createdAt" AS created_at, "emailVerified" AS verified FROM "user" WHERE "id" = $1 AND "role" = 'CUSTOMER'`, [id]);
  if (!user) notFound();
  const { rows: [account] } = await db.query<{ id: string; balance: number; lifetime_earned: number; member_code: string; status: string }>(
    "SELECT id, balance, lifetime_earned, member_code, status FROM loyalty_accounts WHERE user_id = $1", [id]);
  const [{ rows: orders }, history] = await Promise.all([
    db.query<{ number: string; status: State; total: number; created_at: Date | string; channel: string }>(
      "SELECT number::text AS number, status, total, created_at, channel FROM orders WHERE customer_user_id = $1 ORDER BY created_at DESC LIMIT 50", [id]),
    account ? accountHistory(account.id, 20, db) : Promise.resolve([]),
  ]);
  return <section className="wrap catalog-page">
    <p><Link href={`/${lang}/admin/customers`}>← {fr ? "Tous les clients" : "All customers"}</Link></p>
    <h1>{user.name}</h1>
    <p>{user.email}{!user.verified && ` (${fr ? "non confirmé" : "unconfirmed"})`} · {fr ? "inscrit le" : "joined"} {pickupDate(new Date(user.created_at).toISOString(), lang)}</p>
    <h2>{fr ? "Récompenses" : "Rewards"}</h2>
    {account ? <p>{account.balance} {fr ? "tampons" : "stamps"} · {fr ? "cumulés" : "lifetime"} {account.lifetime_earned} · {fr ? "code" : "code"} {account.member_code} · {account.status}
      {" "}<Link href={`/${lang}/admin/rewards?q=${encodeURIComponent(account.member_code)}`}>{fr ? "Ajuster les tampons" : "Adjust stamps"}</Link></p> : <p>{fr ? "N’a pas adhéré." : "Has not joined."}</p>}
    {history.length > 0 && <ul>{history.map(row => <li key={row.id}>{pickupDate(new Date(row.created_at).toISOString(), lang)} · {row.kind} {row.points > 0 ? "+" : ""}{row.points} → {row.balance_after}{row.order_number ? ` · #${row.order_number}` : ""}</li>)}</ul>}
    <h2>{fr ? "Commandes" : "Orders"}</h2>
    {!orders.length ? <p>{fr ? "Aucune commande." : "No orders."}</p> : <ul>{orders.map(order => <li key={order.number}>#{order.number} · {stateLabels[order.status][lang]} · {money(order.total, lang)} · {pickupDate(new Date(order.created_at).toISOString(), lang)}{order.channel === "COUNTER" && ` · ${fr ? "comptoir" : "counter"}`}</li>)}</ul>}
  </section>;
}
