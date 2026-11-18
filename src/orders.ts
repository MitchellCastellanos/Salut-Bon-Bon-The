import { pickupConfiguration } from "./store-settings";
import { eligiblePickup } from "./pickup-policy";
import { businessSnapshot, computeTax, unconfiguredFiscal } from "./business";
import { quoteOfficial } from "./catalog-pricing";
import { usesOfficialCatalog } from "./catalog-mode";
import { createHash, randomBytes } from "node:crypto";
import type { z } from "zod";
import { database, postgresPool } from "./db";
import { checkoutSchema, quote, transitions, type State } from "./domain";

type Payment = "UNPAID" | "PAID_AT_PICKUP" | "DEMO_PAID" | "PAID_ONLINE" | "PAYMENT_FAILED" | "REFUND_REQUIRED";
type Order = {
  number: string; customer: string; notes: string; pickup_at: Date; created_at: Date; status: State;
  payment: Payment; total: number; items: ReturnType<typeof quote> | Awaited<ReturnType<typeof quoteOfficial>>;
};
type Receipt = { number: string; tracking_token: string; request_fingerprint: string };
const settled = "('PAID_AT_PICKUP', 'PAID_ONLINE', 'DEMO_PAID')";

export async function placeOrder(input: z.infer<typeof checkoutSchema>, analytics?: { campaign: string | null }, customerUserId?: string) {
  const { request, lang, name, notes, pickup, method, lines, email } = input;
  const fingerprint = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const db = await database();
  const existing = async (connection = db) => (await connection.query<Receipt>(
    "SELECT number, tracking_token, request_fingerprint FROM orders WHERE request_id = $1", [request]
  )).rows[0];
  const match = (order: Receipt) => {
    if (order.request_fingerprint !== fingerprint) throw new Error("CONFLICT");
    return order;
  };
  const previous = await existing();
  if (previous) return match(previous);
  const time = Date.parse(pickup);
  const official = usesOfficialCatalog();
  const config = official ? await pickupConfiguration() : null;
  const policy = config?.enabled ? config.ready : null;
  if (official ? !policy || !eligiblePickup(time, policy) :
      time % 900000 || time < Date.now() + 14 * 60000 || time > Date.now() + 3 * 3600000) throw new Error("SLOT");
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
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const { cents: tax, lines: taxLines } = official && config ? computeTax(subtotal, config.fiscal) : computeTax(subtotal, unconfiguredFiscal);
  const snapshot = official && config?.profile ? businessSnapshot(config.profile, config.fiscal) : null;
  const total = subtotal + tax;
  if (official && input.expectedTotal !== total) throw new Error("PRICE");
  const token = randomBytes(32).toString("hex");
  const conversion = official && analytics ? `, conversion AS (
    INSERT INTO marketing_events (event, campaign_id)
    SELECT 'completed_order', (SELECT id FROM marketing_campaigns WHERE id = $17) FROM inserted
  )` : "";
  const insert = (connection = db) => connection.query<Receipt>(`
    WITH inserted AS (
      INSERT INTO orders (request_id, request_fingerprint, tracking_token, locale, customer, notes, pickup_at, items, total, payment, tax_cents, customer_email, payment_method, customer_user_id, tax_breakdown, business_snapshot)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (request_id) DO NOTHING
      RETURNING number, tracking_token, request_fingerprint
    ), event AS (
      INSERT INTO order_events (order_number, status) SELECT number, 'RECEIVED' FROM inserted
    ) ${conversion} SELECT * FROM inserted`, [
      request, fingerprint, token, lang, name, notes, pickup, JSON.stringify(items),
      total, method === "demo" ? "DEMO_PAID" : "UNPAID", tax, email ?? null, method, customerUserId ?? null,
      official ? JSON.stringify(taxLines) : null, snapshot ? JSON.stringify(snapshot) : null,
      ...(conversion ? [analytics?.campaign ?? null] : []),
    ]);
  if (policy) {
    const client = await postgresPool().connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(73621, $1::int)", [Math.floor(time / 60000)]);
      const alreadyPlaced = await existing(client);
      if (alreadyPlaced) {
        const receipt = match(alreadyPlaced);
        await client.query("COMMIT");
        return receipt;
      }
      const { rows: [slot] } = await client.query<{ reservations: number }>(
        "SELECT count(*)::int AS reservations FROM orders WHERE pickup_at = $1 AND status <> 'CANCELLED'", [pickup]
      );
      if (slot.reservations >= policy.slotCapacity) throw new Error("SLOT");
      const placed = await insert(client);
      await client.query("COMMIT");
      if (placed.rows[0]) return placed.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } else {
    const result = await insert();
    if (result.rows[0]) return result.rows[0];
  }
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
export async function listOrders(filter: { q?: string; status?: string } = {}) {
  return (await (await database()).query<Order & { tax_cents: number; payment_method: string }>(`
    SELECT number, customer, notes, pickup_at, created_at, status, payment, total, items, tax_cents, payment_method
    FROM orders
    WHERE ($2 = '' OR status = $2)
      AND ($1 = '' OR number::text = $1 OR position(lower($1) in lower(customer)) > 0)
    ORDER BY (status IN ('COMPLETED','CANCELLED')), created_at DESC LIMIT 100
  `, [filter.q ?? "", filter.status ?? ""])).rows;
}
export async function updateOrder(number: string, from: State, to: State) {
  if (!transitions[from].includes(to)) return false;
  const result = await (await database()).query(`
    WITH changed AS (
      UPDATE orders SET status = $3,
        payment = CASE WHEN $3 = 'CANCELLED' AND payment = 'PAID_ONLINE' THEN 'REFUND_REQUIRED' ELSE payment END
      WHERE number = $1 AND status = $2
        AND ($3 <> 'COMPLETED' OR payment IN ${settled})
        AND ($3 <> 'CONFIRMED' OR payment_method <> 'card' OR payment = 'PAID_ONLINE')
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

export type ReceiptDetails = {
  number: string; created_at: Date | string; pickup_at: Date | string; locale: "fr" | "en"; payment: string; payment_method: string;
  total: number; tax_cents: number; items: { name: { fr: string; en: string }; quantity: number; size?: string; subtotal: number; selectedModifiers?: { fr: string; en: string }[] }[];
  tax_breakdown: { code: "GST" | "QST"; rate: number; cents: number }[] | null; business_snapshot: import("./business-core").BusinessSnapshot | null;
};

/** The customer's receipt, reconstructed only from what was stored when the order was placed. */
export async function receiptFor(token: string) {
  if (!/^[0-9a-f]{64}$/.test(token)) return undefined;
  return (await (await database()).query<ReceiptDetails>(`
    SELECT number::text AS number, created_at, pickup_at, locale, payment, payment_method, total, tax_cents, items, tax_breakdown, business_snapshot
    FROM orders WHERE tracking_token = $1`, [token])).rows[0];
}
