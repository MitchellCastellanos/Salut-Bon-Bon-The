import Link from "next/link";
import { notFound } from "next/navigation";
import { demoMode } from "../../../../src/demo-mode";
import { database } from "../../../../src/db";
import { language, pickupDate } from "../../../../src/domain";
import { emailMode, orderEmail, type EmailKind } from "../../../../src/notifications";
import { staffRole } from "../../../../src/staff";

export const metadata = { robots: { index: false, follow: false } };
const mask = (email: string) => email.includes("@") ? `${email.slice(0, 2)}…@${email.split("@")[1]}` : email;

/** Every transactional email the platform produced, whether or not a provider is connected, with a safe preview and the delivery status. */
export default async function AdminNotifications({ params, searchParams }: PageProps<"/[lang]/admin/notifications">) {
  const { lang } = await params;
  if (!language(lang) || !process.env.DATABASE_URL || await staffRole() !== "ADMIN") notFound();
  const query = await searchParams;
  const open = typeof query.open === "string" && /^\d{1,18}$/.test(query.open) ? query.open : "";
  const status = typeof query.status === "string" && ["PENDING", "SENT", "FAILED", "SKIPPED"].includes(query.status) ? query.status : "";
  const db = await database();
  const [{ rows }, { rows: counts }] = await Promise.all([
    db.query<{ id: string; order_number: string; kind: EmailKind; recipient: string; locale: "fr" | "en"; status: string; attempts: number; last_error: string | null; created_at: Date | string }>(
      `SELECT id::text, order_number::text, kind, recipient, locale, status, attempts, last_error, created_at FROM email_outbox WHERE ($1 = '' OR status = $1) ORDER BY id DESC LIMIT 100`, [status]),
    db.query<{ status: string; n: number }>("SELECT status, count(*)::int AS n FROM email_outbox GROUP BY status"),
  ]);
  let preview: { subject: string; text: string } | undefined;
  const selected = rows.find(row => row.id === open);
  if (selected) {
    const { rows: [order] } = await db.query<Parameters<typeof orderEmail>[1]>(
      "SELECT number::text AS number, customer, locale, pickup_at, total, tax_cents, payment, tracking_token, items, tax_breakdown, business_snapshot FROM orders WHERE number = $1", [selected.order_number]);
    if (order) preview = orderEmail(selected.kind, order, selected.locale);
  }
  const mode = emailMode();
  const tally = Object.fromEntries(counts.map(row => [row.status, row.n]));
  return <section className="wrap catalog-page">
    <h1>Notifications</h1>
    <p className="panel" role="status">Email provider: <strong>{mode === "disabled" ? (demoMode() ? "not connected (demo): messages are recorded here and never sent" : "not connected") : mode}</strong>. Messages are transactional only (order received, ready, cancelled). The templates are bilingual and live in the code.</p>
    <div className="console-stats">{["SENT", "SKIPPED", "FAILED", "PENDING"].map(s => <div className="panel" key={s}><small>{s.toLowerCase()}</small><strong>{tally[s] ?? 0}</strong></div>)}</div>
    <form className="catalog-filters"><label>Status<select name="status" defaultValue={status}><option value="">All</option>{["PENDING", "SENT", "FAILED", "SKIPPED"].map(s => <option key={s} value={s}>{s.toLowerCase()}</option>)}</select></label><button className="outline">Filter</button></form>
    {!rows.length ? <p>No messages yet. They appear when orders are placed, ready or cancelled.</p> : <div className="table-scroll"><table className="price-table">
      <thead><tr><th>When</th><th>Order</th><th>Message</th><th>To</th><th>Status</th><th></th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.id}>
        <td>{pickupDate(new Date(row.created_at).toISOString(), "en")}</td><td><Link href={`/${lang}/admin/orders/${row.order_number}`}>#{row.order_number}</Link></td>
        <td>{row.kind.replaceAll("_", " ")} ({row.locale.toUpperCase()})</td><td>{mask(row.recipient)}</td>
        <td>{row.status.toLowerCase()}{row.last_error && <small> · {row.last_error}</small>}</td>
        <td><Link href={`/${lang}/admin/notifications?open=${row.id}${status ? `&status=${status}` : ""}`}>Preview</Link></td></tr>)}</tbody></table></div>}
    {preview && <article className="panel" aria-label="Email preview"><h2>{preview.subject}</h2><pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{preview.text}</pre></article>}
  </section>;
}
