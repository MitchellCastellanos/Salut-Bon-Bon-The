import Link from "next/link";
import { notFound } from "next/navigation";
import { database } from "../../../../src/db";
import { language, money, pickupDate, stateLabels, states, type State } from "../../../../src/domain";
import { staffRole } from "../../../../src/staff";

export const metadata = { robots: { index: false, follow: false } };
const pageSize = 25;
const payments = ["UNPAID", "PAID_AT_PICKUP", "PAID_ONLINE", "PAYMENT_FAILED", "REFUND_REQUIRED", "REFUNDED"] as const;

export default async function AdminOrders({ params, searchParams }: PageProps<"/[lang]/admin/orders">) {
  const { lang } = await params;
  if (!language(lang) || !process.env.DATABASE_URL || await staffRole() !== "ADMIN") notFound();
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
  return <section className="wrap catalog-page">
    <h1>Orders</h1>
    <p>{count.n} order(s). Search by number, name or email. <Link href={`/${lang}/staff`}>Live queue</Link> · <Link href={`/${lang}/staff/counter`}>Counter sale</Link></p>
    <form className="catalog-filters" role="search">
      <label>Number, name or email<input name="q" maxLength={80} defaultValue={q}/></label>
      <label>Status<select name="status" defaultValue={status}><option value="">All</option>{states.map(s => <option key={s} value={s}>{stateLabels[s].en}</option>)}</select></label>
      <label>Payment<select name="payment" defaultValue={payment}><option value="">All</option>{payments.map(p => <option key={p} value={p}>{p.replaceAll("_", " ").toLowerCase()}</option>)}</select></label>
      <label>From<input type="date" name="from" defaultValue={date}/></label><label>To<input type="date" name="to" defaultValue={to}/></label>
      <button className="outline">Filter</button></form>
    {!rows.length ? <p>No orders match.</p> : <div className="table-scroll"><table className="price-table">
      <thead><tr><th>#</th><th>Customer</th><th>Placed</th><th>Pickup</th><th>Status</th><th>Payment</th><th>Total</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.number}>
        <td><Link href={`/${lang}/admin/orders/${row.number}`}>#{row.number}</Link>{row.channel === "COUNTER" && <small> counter</small>}</td>
        <td>{row.customer}</td><td>{pickupDate(new Date(row.created_at).toISOString(), "en")}</td><td>{pickupDate(new Date(row.pickup_at).toISOString(), "en")}</td>
        <td>{stateLabels[row.status].en}</td><td>{row.payment.replaceAll("_", " ").toLowerCase()}</td>
        <td>{money(row.total, "en")}{row.refunded > 0 && <small> (refunded {money(row.refunded, "en")})</small>}</td></tr>)}</tbody></table></div>}
    <p>{page > 1 && <Link href={link(page - 1)}>← Previous</Link>}{page > 1 && page < pages && " · "}{page < pages && <Link href={link(page + 1)}>Next →</Link>} <small>{page}/{pages}</small></p>
  </section>;
}
