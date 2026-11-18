import { quoteOfficial } from "./catalog-pricing";
import { usesOfficialCatalog } from "./catalog-mode";
import { createHash, randomBytes } from "node:crypto";
import type { z } from "zod";
import { database } from "./db";
import { checkoutSchema, quote, transitions, type State } from "./domain";

type Payment = "UNPAID" | "PAID_AT_PICKUP" | "DEMO_PAID";
type Order = {
  number: string; customer: string; notes: string; pickup_at: Date; created_at: Date; status: State;
  payment: Payment; total: number; items: ReturnType<typeof quote> | Awaited<ReturnType<typeof quoteOfficial>>;
};
type Receipt = { number: string; tracking_token: string; request_fingerprint: string };

export async function placeOrder(input: z.infer<typeof checkoutSchema>) {
  const { request, lang, name, notes, pickup, method, lines } = input;
  const fingerprint = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const db = await database();
  const existing = async () => (await db.query<Receipt>(
    "SELECT number, tracking_token, request_fingerprint FROM orders WHERE request_id = $1", [request]
  )).rows[0];
  const match = (order: Receipt) => {
    if (order.request_fingerprint !== fingerprint) throw new Error("CONFLICT");
    return order;
  };
  const previous = await existing();
  if (previous) return match(previous);
  const time = Date.parse(pickup);
  if (time % 900000 || time < Date.now() + 14 * 60000 || time > Date.now() + 3 * 3600000) throw new Error("SLOT");
  const official = usesOfficialCatalog();
  if (official && method !== "pickup") throw new Error("MENU");
  if (official) {
    const { rows } = await db.query(`
      INSERT INTO checkout_rate_limit (id, minute, attempts)
      VALUES (1, date_trunc('minute', now()), 1)
      ON CONFLICT (id) DO UPDATE SET minute = EXCLUDED.minute,
        attempts = CASE WHEN checkout_rate_limit.minute = EXCLUDED.minute THEN checkout_rate_limit.attempts + 1 ELSE 1 END
      WHERE checkout_rate_limit.minute <> EXCLUDED.minute OR checkout_rate_limit.attempts < 60
      RETURNING id
    `);
    if (!rows.length) throw new Error("RATE");
  }
  const items = official ? await quoteOfficial(lines) : quote(lines);
  const total = items.reduce((sum, item) => sum + item.subtotal, 0);
  if (official && input.expectedTotal !== total) throw new Error("PRICE");
  const token = randomBytes(32).toString("hex");
  const result = await db.query<Receipt>(`
    WITH inserted AS (
      INSERT INTO orders (request_id, request_fingerprint, tracking_token, locale, customer, notes, pickup_at, items, total, payment)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (request_id) DO NOTHING
      RETURNING number, tracking_token, request_fingerprint
    ), event AS (
      INSERT INTO order_events (order_number, status) SELECT number, 'RECEIVED' FROM inserted
    ) SELECT * FROM inserted`, [
      request, fingerprint, token, lang, name, notes, pickup, JSON.stringify(items),
      total, method === "demo" ? "DEMO_PAID" : "UNPAID",
    ]);
  if (result.rows[0]) return result.rows[0];
  const repeated = await existing();
  if (!repeated) throw new Error("CONFLICT");
  return match(repeated);
}
export async function trackOrder(token: string) {
  if (!/^[0-9a-f]{64}$/.test(token)) return undefined;
  return (await (await database()).query<Pick<Order, "number" | "status" | "pickup_at">>(
    "SELECT number, status, pickup_at FROM orders WHERE tracking_token = $1", [token]
  )).rows[0];
}
export async function listOrders() {
  return (await (await database()).query<Order>(`
    SELECT number, customer, notes, pickup_at, created_at, status, payment, total, items
    FROM orders ORDER BY (status IN ('COMPLETED','CANCELLED')), created_at DESC LIMIT 100
  `)).rows;
}
export async function updateOrder(number: string, from: State, to: State) {
  if (!transitions[from].includes(to)) return false;
  const result = await (await database()).query(`
    WITH changed AS (
      UPDATE orders SET status = $3
      WHERE number = $1 AND status = $2 AND ($3 <> 'COMPLETED' OR payment <> 'UNPAID')
      RETURNING number
    )
    INSERT INTO order_events (order_number, status) SELECT number, $3 FROM changed RETURNING id
  `, [number, from, to]);
  return Boolean(result.rows.length);
}
export async function recordPayment(number: string) {
  return Boolean((await (await database()).query(`
    UPDATE orders SET payment = 'PAID_AT_PICKUP'
    WHERE number = $1 AND status = 'READY' AND payment = 'UNPAID' RETURNING number
  `, [number])).rows.length);
}
