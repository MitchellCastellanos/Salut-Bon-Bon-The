import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { database } from "../../../../../src/db";
import { modifiers, money, pickupDate, stateLabels, type State } from "../../../../../src/domain";
import { orderStatusLabel, paymentLabel, paymentLabels } from "../../../../../src/labels";
import { adminPage } from "../../guard";
import { Badge, Notice, PageHeader } from "../../ui";
import { Submit } from "../../submit";
import { cancelOrder, refund } from "./actions";

export const metadata = { robots: { index: false, follow: false } };
const errors: Record<string, string> = {
  INVALID: "Check the amount and give a reason of at least 3 characters.", AMOUNT: "The amount is more than what remains refundable.",
  NOT_REFUNDABLE: "This order has no refundable payment.", PROVIDER_UNAVAILABLE: "Stripe is not connected: refund this payment in the Stripe dashboard.",
  PROVIDER_FAILED: "Stripe refused the refund. Nothing was recorded.", NOT_FOUND: "Order not found.", STATE: "This order has already changed status (someone else may have updated it). Review it below.",
};

export default async function AdminOrder({ params, searchParams }: PageProps<"/[lang]/admin/orders/[number]">) {
  const { lang: rawLang, number } = await params;
  const lang = await adminPage(rawLang);
  if (!/^[1-9]\d{0,17}$/.test(number)) notFound();
  const query = await searchParams;
  const db = await database();
  const { rows: [order] } = await db.query<{ number: string; customer: string; customer_email: string | null; notes: string | null; status: State; payment: string; payment_method: string; total: number; tax_cents: number;
    channel: string; counter_tender: string | null; created_by: string | null; pickup_at: Date | string; created_at: Date | string; tracking_token: string; items: { name: { fr: string; en: string }; quantity: number; size?: string; subtotal: number; sugar?: string; ice?: string; selectedModifiers?: { en: string }[] }[]; customer_user_id: string | null }>(
    `SELECT number::text, customer, customer_email, notes, status, payment, payment_method, total, tax_cents, channel, counter_tender, created_by, pickup_at, created_at, tracking_token, items, customer_user_id FROM orders WHERE number = $1`, [number]);
  if (!order) notFound();
  const [events, attempts, refunds, mails, stamps] = await Promise.all([
    db.query<{ status: string; occurred_at: Date | string }>("SELECT status, created_at AS occurred_at FROM order_events WHERE order_number = $1 ORDER BY id", [number]),
    db.query<{ provider: string; status: string; amount_cents: number; created_at: Date | string }>("SELECT provider, status, amount_cents, created_at FROM payment_attempts WHERE order_number = $1 ORDER BY id", [number]),
    db.query<{ amount_cents: number; reason: string; provider: string; actor: string; created_at: Date | string }>("SELECT amount_cents, reason, provider, actor, created_at FROM order_refunds WHERE order_number = $1 ORDER BY id", [number]),
    db.query<{ kind: string; status: string; last_error: string | null }>("SELECT kind, status, last_error FROM email_outbox WHERE order_number = $1 ORDER BY id", [number]),
    db.query<{ points: number; kind: string }>("SELECT points, kind FROM loyalty_transactions WHERE order_number = $1 ORDER BY id", [number]),
  ]);
  const refunded = refunds.rows.reduce((sum, row) => sum + row.amount_cents, 0);
  const remaining = order.total - refunded;
  const refundable = ["PAID_ONLINE", "REFUND_REQUIRED", "PAID_AT_PICKUP"].includes(order.payment) && remaining > 0;
  const stamp = (k: string) => String(query[k] ?? "");
  return <section className="wrap">
    <p><Link href={`/${lang}/admin/orders`}>← Order history</Link></p>
    <PageHeader title={`Order #${order.number}`} intro={<><Badge tone={order.status === "CANCELLED" ? "bad" : order.status === "COMPLETED" ? "good" : "warn"}>{orderStatusLabel[order.status]}</Badge> <Badge tone={paymentLabels[order.payment]?.tone}>{paymentLabel(order.payment)}</Badge> {paymentLabels[order.payment]?.help}</>}/>
    <Notice saved={stamp("done")} error={stamp("error")} saves={{ cancel: "Order cancelled. The customer was notified.", refund: "Refund recorded." }} errors={errors}/>
    <div className="order-grid">
      <article className="panel"><h2>Order</h2>
        <p><strong>{stateLabels[order.status].en}</strong> · {paymentLabel(order.payment)} ({order.payment_method === "card" ? "card" : "pay at pickup"})</p>
        <p>{order.customer}{order.customer_email && ` · ${order.customer_email}`}{order.customer_user_id && <> · <Link href={`/${lang}/admin/customers/${order.customer_user_id}`}>account</Link></>}</p>
        <p>Pickup {pickupDate(new Date(order.pickup_at).toISOString(), "en")} · placed {pickupDate(new Date(order.created_at).toISOString(), "en")}{order.channel === "COUNTER" && ` · counter sale (${order.counter_tender}) by ${order.created_by}`}</p>
        {order.notes && <p>Note: {order.notes}</p>}
        <ul>{order.items.map((item, i) => <li key={i}>{item.quantity} × {item.name.en}{item.size ? ` · ${modifiers[item.size as "regular" | "large"]?.en ?? item.size}` : ""}{item.selectedModifiers?.length ? ` · ${item.selectedModifiers.map(m => m.en).join(", ")}` : ""} · {money(item.subtotal, "en")}</li>)}</ul>
        <p>Tax {money(order.tax_cents, "en")} · <strong>Total {money(order.total, "en")}</strong>{refunded > 0 && ` · refunded ${money(refunded, "en")}`}</p>
        <p><Link href={`/${lang}/track/${order.tracking_token}`}>Customer tracking page</Link> · <Link href={`/${lang}/track/${order.tracking_token}/receipt`}>Receipt</Link></p>
      </article>
      <article className="panel"><h2>History</h2>
        <ol>{events.rows.map((e, i) => <li key={i}>{stateLabels[e.status as State]?.en ?? e.status} · {pickupDate(new Date(e.occurred_at).toISOString(), "en")}</li>)}</ol>
        {stamps.rows.length > 0 && <p>Stamps: {stamps.rows.map(s => `${s.points > 0 ? "+" : ""}${s.points} (${s.kind})`).join(", ")}</p>}
        {attempts.rows.length > 0 && <><h3>Payment attempts</h3><ul>{attempts.rows.map((a, i) => <li key={i}>{a.provider} · {a.status} · {money(a.amount_cents, "en")}</li>)}</ul></>}
        {mails.rows.length > 0 && <><h3>Emails</h3><ul>{mails.rows.map((m, i) => <li key={i}>{m.kind.replaceAll("_", " ")} · {m.status.toLowerCase()}{m.last_error && ` (${m.last_error})`}</li>)}</ul></>}
      </article>
    </div>
    {["RECEIVED", "CONFIRMED", "PREPARING", "READY"].includes(order.status) && <form className="admin-form" action={cancelOrder.bind(null, lang)}>
      <h2>Cancel the order</h2><input type="hidden" name="order" value={order.number}/><input type="hidden" name="from" value={order.status}/>
      <label>Reason (kept in the change history)<input name="reason" required minLength={3} maxLength={280}/></label>
      <div><Submit className="danger" confirm="Cancel this order? The customer will be notified. A paid online order will then need a refund.">Cancel order</Submit></div></form>}
    {refunds.rows.length > 0 && <div className="panel"><h2>Refunds</h2><ul>{refunds.rows.map((r, i) => <li key={i}>{money(r.amount_cents, "en")} · {r.provider} · {r.reason} · {r.actor} · {pickupDate(new Date(r.created_at).toISOString(), "en")}</li>)}</ul></div>}
    {refundable && <form className="admin-form" action={refund.bind(null, lang)}>
      <h2>Refund</h2><input type="hidden" name="order" value={order.number}/><input type="hidden" name="key" value={`refund-${randomUUID()}`}/>
      <label>Amount in dollars, tax included (up to {(remaining / 100).toFixed(2)})<input name="amount" inputMode="decimal" pattern="\d{1,5}(\.\d{1,2})?" required defaultValue={(remaining / 100).toFixed(2)}/></label>
      <label>Reason<input name="reason" required minLength={3} maxLength={280}/></label>
      <p className="fine-print">{order.payment_method === "card" ? "Simulated payments are refunded in the simulation; real Stripe payments are refunded through Stripe." : "Pay-at-pickup payments are recorded as a manual refund: hand the money back at the counter."} Stamps earned on this order are taken back in proportion.</p>
      <div><Submit className="danger" confirm="Record this refund? It cannot be undone and stamps earned on the order are taken back.">Refund</Submit></div></form>}
  </section>;
}
