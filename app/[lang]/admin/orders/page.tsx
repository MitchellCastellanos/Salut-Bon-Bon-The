import Link from "next/link";
import { database } from "../../../../src/db";
import { money, pickupDate, states, type State } from "../../../../src/domain";
import { orderStatusLabel, paymentLabel, paymentLabels } from "../../../../src/labels";
import { adminPage } from "../guard";
import { Badge, PageHeader } from "../ui";

export const metadata = { robots: { index: false, follow: false } };
const pageSize = 25;
const payments = ["UNPAID", "PAID_AT_PICKUP", "PAID_ONLINE", "PAYMENT_FAILED", "REFUND_REQUIRED", "REFUNDED"] as const;

export default async function AdminOrders({ params, searchParams }: PageProps<"/[lang]/admin/orders">) {
  const lang = await adminPage((await params).lang);
  const query = await searchParams;
  const str = (key: string, max = 80) => typeof query[key] === "string" ? (query[key] as string).trim().slice(0, max) : "";
  const q = str("q"), status = (states as readonly string[]).includes(str("status")) ? str("status") : "", payment = (payments as readonly string[]).includes(str("payment")) ? str("payment") : "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(str("from", 10)) ? str("from", 10) : "", to = /^\d{4}-\d{2}-\d{2}$/.test(str("to", 10)) ? str("to", 10) : "";
  const page = Math.max(1, Math.min(10000, Number(str("page", 5)) || 1));
  const filter = `($1 = '' OR number::text = $1 OR position(lower($1) in lower(customer)) > 0 OR position(lower($1) in lower(coalesce(customer_email, ''))) > 0)
    AND ($2 = '' OR status = $2) AND ($3 = '' OR payment = $3)
    AND ($4 = '' OR created_at >= ($4::date)::timestamp AT TIME ZONE 'America/Toronto') AND ($5 = '' OR created_at < (($5::date) + 1)::timestamp AT TIME ZONE 'America/Toronto')`;
  const args = [q, status, payment, date, to];
  const db = await database();
  const [{ rows }, { rows: [count] }] = await Promise.all([
    db.query<{ number: string; customer: string; status: State; payment: string; total: number; channel: string; created_at: Date | string; pickup_at: Date | string; refunded: number }>(`
      SELECT number::text, customer, status, payment, total, channel, created_at, pickup_at,
        coalesce((SELECT sum(amount_cents) FROM order_refunds r WHERE r.order_number = orders.number), 0)::int AS refunded
      FROM orders WHERE ${filter} ORDER BY created_at DESC LIMIT ${pageSize} OFFSET $6`, [...args, (page - 1) * pageSize]),
    db.query<{ n: number }>(`SELECT count(*)::int AS n FROM orders WHERE ${filter}`, args),
  ]);
  const pages = Math.max(1, Math.ceil(count.n / pageSize));
  const link = (p: number) => `/${lang}/admin/orders?${new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}), ...(payment ? { payment } : {}), ...(date ? { from: date } : {}), ...(to ? { to } : {}), page: String(p) })}`;
  return <section className="wrap">
    <PageHeader title="Order history" intro={<>{count.n} order(s). Search by number, customer name or email. For orders being prepared right now, use the <Link href={`/${lang}/staff`}>live queue</Link>.</>}/>
    <form className="catalog-filters" role="search" aria-label="Filter orders">
      <label>Number, name or email<input name="q" maxLength={80} defaultValue={q}/></label>
      <label>Status<select name="status" defaultValue={status}><option value="">All</option>{states.map(s => <option key={s} value={s}>{orderStatusLabel[s]}</option>)}</select></label>
      <label>Payment<select name="payment" defaultValue={payment}><option value="">All</option>{payments.map(p => <option key={p} value={p}>{paymentLabel(p)}</option>)}</select></label>
      <label>From<input type="date" name="from" defaultValue={date}/></label><label>To<input type="date" name="to" defaultValue={to}/></label>
      <button className="outline">Filter</button></form>
    {!rows.length ? <p>No orders match.</p> : <ul className="admin-list">{rows.map(row => <li key={row.number} className="admin-row">
      <div><h3><Link href={`/${lang}/admin/orders/${row.number}`}>Order #{row.number}</Link> {row.channel === "COUNTER" && <Badge>counter</Badge>}</h3>
        <p>{row.customer} · placed {pickupDate(new Date(row.created_at).toISOString(), "en")} · pickup {pickupDate(new Date(row.pickup_at).toISOString(), "en")}</p></div>
      <div className="admin-row-actions"><Badge tone={row.status === "CANCELLED" ? "bad" : row.status === "COMPLETED" ? "good" : "warn"}>{orderStatusLabel[row.status]}</Badge>
        <Badge tone={paymentLabels[row.payment]?.tone}>{paymentLabel(row.payment)}</Badge><strong>{money(row.total, "en")}</strong>{row.refunded > 0 && <small>refunded {money(row.refunded, "en")}</small>}</div>
    </li>)}</ul>}
    <p>{page > 1 && <Link href={link(page - 1)}>← Previous</Link>}{page > 1 && page < pages && " · "}{page < pages && <Link href={link(page + 1)}>Next →</Link>} <small>Page {page} of {pages}</small></p>
  </section>;
}
