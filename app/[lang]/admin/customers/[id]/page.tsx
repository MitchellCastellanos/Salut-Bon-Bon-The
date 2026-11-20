import Link from "next/link";
import { notFound } from "next/navigation";
import { database } from "../../../../../src/db";
import { money, pickupDate, stateLabels, type State } from "../../../../../src/domain";
import { accountHistory } from "../../../../../src/loyalty";
import { paymentLabel } from "../../../../../src/labels";
import { adminPage } from "../../guard";
import { Badge, Notice, PageHeader } from "../../ui";
import { Submit } from "../../submit";
import { cardQrAction } from "../actions";

export const metadata = { robots: { index: false, follow: false } };

export default async function AdminCustomer({ params, searchParams }: PageProps<"/[lang]/admin/customers/[id]">) {
  const { lang: rawLang, id } = await params;
  const lang = await adminPage(rawLang);
  if (!/^[\w-]{1,64}$/.test(id)) notFound();
  const query = await searchParams;
  const db = await database();
  const { rows: [user] } = await db.query<{ id: string; name: string; email: string; created_at: Date | string; verified: boolean }>(
    `SELECT "id", "name", "email", "createdAt" AS created_at, "emailVerified" AS verified FROM "user" WHERE "id" = $1 AND "role" = 'CUSTOMER'`, [id]);
  if (!user) notFound();
  const { rows: [account] } = await db.query<{ id: string; balance: number; lifetime_earned: number; member_code: string; status: string }>(
    "SELECT id, balance, lifetime_earned, member_code, status FROM loyalty_accounts WHERE user_id = $1", [id]);
  const [{ rows: orders }, history] = await Promise.all([
    db.query<{ number: string; status: State; payment: string; total: number; created_at: Date | string; channel: string }>(
      "SELECT number::text AS number, status, payment, total, created_at, channel FROM orders WHERE customer_user_id = $1 ORDER BY created_at DESC LIMIT 50", [id]),
    account ? accountHistory(account.id, 20, db) : Promise.resolve([]),
  ]);
  return <section className="wrap">
    <p><Link href={`/${lang}/admin/customers`}>← All customers</Link></p>
    <PageHeader title={user.name} intro={<>{user.email} {!user.verified && <Badge tone="warn">email not confirmed</Badge>} · joined {pickupDate(new Date(user.created_at).toISOString(), "en")}</>}/>
    <Notice saved={query.saved} saves={{ rotate: "Card QR replaced. The old one no longer works.", revoke: "Card QR revoked and the Wallet pass voided." }}/>
    <h2>Salut Rewards</h2>
    {account ? <div className="admin-form">
      <p><strong>{account.balance} stamp(s)</strong> toward the next free drink · {account.lifetime_earned} earned in total · card {account.member_code} · {account.status === "active" ? <Badge tone="good">active</Badge> : <Badge tone="bad">{account.status}</Badge>}</p>
      <div className="admin-row-actions" style={{ justifyContent: "flex-start" }}>
        <Link className="outline" href={`/${lang}/admin/rewards?q=${encodeURIComponent(account.member_code)}`}>Adjust stamps or suspend</Link>
        <form action={cardQrAction.bind(null, lang)}><input type="hidden" name="account" value={account.id}/><input type="hidden" name="user" value={id}/>
          <Submit className="outline" name="op" value="rotate" confirm="Replace this customer’s card QR? The old QR stops working immediately.">Replace card QR</Submit>{" "}
          <Submit className="danger" name="op" value="revoke" confirm="Revoke the card QR and void the Wallet pass? The customer will have no working card until you replace it.">Revoke card QR</Submit></form>
      </div>
      <p className="admin-hint">Use these after a lost phone or a leaked card. The old QR stops working immediately.</p>
      {history.length > 0 && <ul>{history.map(row => <li key={row.id}>{pickupDate(new Date(row.created_at).toISOString(), "en")} · {row.kind} {row.points > 0 ? "+" : ""}{row.points} → {row.balance_after}{row.order_number ? ` · order #${row.order_number}` : ""}</li>)}</ul>}
    </div> : <p>This customer has not joined Salut Rewards.</p>}
    <h2>Orders</h2>
    {!orders.length ? <p>No orders yet.</p> : <ul className="admin-list">{orders.map(order => <li key={order.number} className="admin-row">
      <div><h3><Link href={`/${lang}/admin/orders/${order.number}`}>Order #{order.number}</Link></h3><p>{pickupDate(new Date(order.created_at).toISOString(), "en")}{order.channel === "COUNTER" && " · counter sale"}</p></div>
      <div className="admin-row-actions"><Badge>{stateLabels[order.status].en}</Badge><Badge>{paymentLabel(order.payment)}</Badge><strong>{money(order.total, "en")}</strong></div>
    </li>)}</ul>}
  </section>;
}
