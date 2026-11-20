import { audit, type Db } from "./admin-menu";
import { database } from "./db";

const handle = (db?: Db) => db ?? database();
const zone = "America/Toronto";
const isoDay = /^\d{4}-\d{2}-\d{2}$/;

export type Range = { from: string; to: string; preset: string };
export const presets: { id: string; label: string; days: number }[] = [
  { id: "today", label: "Today", days: 1 }, { id: "7", label: "Last 7 days", days: 7 }, { id: "30", label: "Last 30 days", days: 30 }, { id: "90", label: "Last 90 days", days: 90 },
];

const day = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

/** Reads ?preset= or ?from=&to= (inclusive, shop time zone). Invalid or oversized ranges fall back to the last 30 days. */
export function reportRange(query: { preset?: string; from?: string; to?: string }, now = new Date()): Range {
  const today = day(now);
  if (query.from && query.to && isoDay.test(query.from) && isoDay.test(query.to) && query.from <= query.to && query.to <= today) {
    const span = (Date.parse(query.to) - Date.parse(query.from)) / 86400000;
    if (span <= 365) return { from: query.from, to: query.to, preset: "custom" };
  }
  const preset = presets.find(item => item.id === query.preset) ?? presets[2];
  const start = new Date(now.getTime() - (preset.days - 1) * 86400000);
  return { from: day(start), to: today, preset: preset.id };
}

export type Report = {
  range: Range;
  orders: { placed: number; completed: number; open: number; cancelled: number; online: number; counter: number };
  sales: { cents: number; refundedCents: number; averageCents: number; simulatedCents: number; awaitingCents: number };
  byDay: { day: string; orders: number; cents: number }[];
  products: { id: string; name: string; units: number; cents: number }[];
  loyalty: { members: number; joined: number; active: number; stamps: number; redemptions: number; ordersWithMember: number };
};

const inRange = "o.created_at >= ($1::date)::timestamp AT TIME ZONE 'America/Toronto' AND o.created_at < (($2::date) + 1)::timestamp AT TIME ZONE 'America/Toronto'";

/** Every figure comes from orders, refunds and the loyalty ledger. Simulated test payments are never counted as sales. */
export async function report(range: Range, db?: Db): Promise<Report> {
  const d = await handle(db);
  const args = [range.from, range.to];
  const [orders, sales, byDay, products, loyalty] = await Promise.all([
    d.query<{ placed: number; completed: number; open: number; cancelled: number; online: number; counter: number }>(`
      SELECT count(*)::int AS placed, count(*) FILTER (WHERE status = 'COMPLETED')::int AS completed,
        count(*) FILTER (WHERE status NOT IN ('COMPLETED', 'CANCELLED'))::int AS open, count(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled,
        count(*) FILTER (WHERE channel = 'ONLINE' AND status <> 'CANCELLED')::int AS online, count(*) FILTER (WHERE channel = 'COUNTER' AND status <> 'CANCELLED')::int AS counter
      FROM orders o WHERE ${inRange}`, args),
    d.query<{ gross: number; refunded: number; n: number; simulated: number; awaiting: number }>(`
      SELECT coalesce(sum(o.total) FILTER (WHERE (o.payment IN ('PAID_ONLINE', 'PAID_AT_PICKUP', 'REFUNDED') AND NOT EXISTS (SELECT 1 FROM payment_attempts a WHERE a.order_number = o.number AND a.provider = 'simulated')) AND o.status <> 'CANCELLED'), 0)::int AS gross,
        coalesce((SELECT sum(r.amount_cents) FROM order_refunds r JOIN orders x ON x.number = r.order_number WHERE x.status <> 'CANCELLED' AND (x.payment IN ('PAID_ONLINE', 'PAID_AT_PICKUP', 'REFUNDED') AND NOT EXISTS (SELECT 1 FROM payment_attempts a WHERE a.order_number = x.number AND a.provider = 'simulated')) AND x.created_at >= ($1::date)::timestamp AT TIME ZONE 'America/Toronto' AND x.created_at < (($2::date) + 1)::timestamp AT TIME ZONE 'America/Toronto'), 0)::int AS refunded,
        count(*) FILTER (WHERE (o.payment IN ('PAID_ONLINE', 'PAID_AT_PICKUP', 'REFUNDED') AND NOT EXISTS (SELECT 1 FROM payment_attempts a WHERE a.order_number = o.number AND a.provider = 'simulated')) AND o.status <> 'CANCELLED')::int AS n,
        coalesce(sum(o.total) FILTER (WHERE (o.payment = 'DEMO_PAID' OR EXISTS (SELECT 1 FROM payment_attempts a WHERE a.order_number = o.number AND a.provider = 'simulated')) AND o.status <> 'CANCELLED'), 0)::int AS simulated,
        coalesce(sum(o.total) FILTER (WHERE o.payment IN ('UNPAID') AND o.status NOT IN ('CANCELLED', 'COMPLETED')), 0)::int AS awaiting
      FROM orders o WHERE ${inRange}`, args),
    d.query<{ day: string; orders: number; cents: number }>(`
      SELECT to_char(o.created_at AT TIME ZONE 'America/Toronto', 'YYYY-MM-DD') AS day, count(*)::int AS orders,
        coalesce(sum(o.total) FILTER (WHERE (o.payment IN ('PAID_ONLINE', 'PAID_AT_PICKUP', 'REFUNDED') AND NOT EXISTS (SELECT 1 FROM payment_attempts a WHERE a.order_number = o.number AND a.provider = 'simulated'))), 0)::int AS cents
      FROM orders o WHERE o.status <> 'CANCELLED' AND ${inRange} GROUP BY 1 ORDER BY 1`, args),
    d.query<{ id: string; name: string; units: number; cents: number }>(`
      SELECT item->>'product' AS id, max(item->'name'->>'en') AS name, sum((item->>'quantity')::int)::int AS units, sum((item->>'subtotal')::int)::int AS cents
      FROM orders o, jsonb_array_elements(o.items) AS item
      WHERE o.status <> 'CANCELLED' AND ${inRange} AND item ? 'product' GROUP BY 1 ORDER BY units DESC, cents DESC, 1 LIMIT 10`, args),
    d.query<{ members: number; joined: number; active: number; stamps: number; redemptions: number; with_member: number }>(`
      SELECT (SELECT count(*) FROM loyalty_accounts WHERE status <> 'merged')::int AS members,
        (SELECT count(*) FROM loyalty_accounts a WHERE status <> 'merged' AND a.enrolled_at >= ($1::date)::timestamp AT TIME ZONE 'America/Toronto' AND a.enrolled_at < (($2::date) + 1)::timestamp AT TIME ZONE 'America/Toronto')::int AS joined,
        (SELECT count(DISTINCT t.account_id) FROM loyalty_transactions t WHERE t.kind IN ('earn', 'redeem') AND t.created_at >= ($1::date)::timestamp AT TIME ZONE 'America/Toronto' AND t.created_at < (($2::date) + 1)::timestamp AT TIME ZONE 'America/Toronto')::int AS active,
        (SELECT coalesce(sum(t.points), 0) FROM loyalty_transactions t WHERE t.kind = 'earn' AND t.created_at >= ($1::date)::timestamp AT TIME ZONE 'America/Toronto' AND t.created_at < (($2::date) + 1)::timestamp AT TIME ZONE 'America/Toronto')::int AS stamps,
        (SELECT count(*) FROM loyalty_transactions t WHERE t.kind = 'redeem' AND t.created_at >= ($1::date)::timestamp AT TIME ZONE 'America/Toronto' AND t.created_at < (($2::date) + 1)::timestamp AT TIME ZONE 'America/Toronto')::int AS redemptions,
        (SELECT count(*) FROM orders o WHERE o.status <> 'CANCELLED' AND (o.loyalty_account_id IS NOT NULL OR o.customer_user_id IS NOT NULL) AND ${inRange})::int AS with_member`, args),
  ]);
  const s = sales.rows[0];
  return {
    range, orders: orders.rows[0],
    sales: { cents: s.gross - s.refunded, refundedCents: s.refunded, averageCents: s.n ? Math.round((s.gross - s.refunded) / s.n) : 0, simulatedCents: s.simulated, awaitingCents: s.awaiting },
    byDay: byDay.rows, products: products.rows,
    loyalty: { members: loyalty.rows[0].members, joined: loyalty.rows[0].joined, active: loyalty.rows[0].active, stamps: loyalty.rows[0].stamps,
      redemptions: loyalty.rows[0].redemptions, ordersWithMember: loyalty.rows[0].with_member },
  };
}

/** Online ordering master switch: one authoritative setting, edited from the dashboard and the store page. Audited. */
export async function setOrderingEnabled(enabled: boolean, actor: string, db?: Db) {
  const d = await handle(db);
  await d.query("INSERT INTO catalog_store_settings (key, value) VALUES ('pickup_checkout_enabled', $1::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [JSON.stringify(enabled)]);
  await audit(d, enabled ? "store.orders-resumed" : "store.orders-paused", "pickup_checkout_enabled", { enabled }, actor);
}

/** What needs the owner's attention right now, from live data only. */
export async function attention(db?: Db) {
  const d = await handle(db);
  const { rows: [s] } = await d.query<{ received: number; confirmed: number; preparing: number; ready: number; completed_today: number; stale: number; refunds: number; failed_mail: number; unpaid_ready: number }>(`
    SELECT count(*) FILTER (WHERE status = 'RECEIVED')::int AS received, count(*) FILTER (WHERE status = 'CONFIRMED')::int AS confirmed,
      count(*) FILTER (WHERE status = 'PREPARING')::int AS preparing, count(*) FILTER (WHERE status = 'READY')::int AS ready,
      count(*) FILTER (WHERE status = 'COMPLETED' AND created_at >= date_trunc('day', now() AT TIME ZONE 'America/Toronto') AT TIME ZONE 'America/Toronto')::int AS completed_today,
      count(*) FILTER (WHERE status = 'RECEIVED' AND created_at < now() - interval '10 minutes')::int AS stale,
      count(*) FILTER (WHERE payment = 'REFUND_REQUIRED')::int AS refunds,
      (SELECT count(*) FROM email_outbox WHERE status = 'FAILED')::int AS failed_mail,
      count(*) FILTER (WHERE status = 'READY' AND payment = 'UNPAID')::int AS unpaid_ready
    FROM orders WHERE created_at > now() - interval '3 days' OR status NOT IN ('COMPLETED', 'CANCELLED')`);
  return s;
}
