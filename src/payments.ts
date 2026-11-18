import type Stripe from "stripe";
import { database } from "./db";

type Db = { query<T extends Record<string, unknown>>(sql: string, args?: unknown[]): Promise<{ rows: T[] }> };

export type Reconciliation =
  | { outcome: "replay" }
  | { outcome: "ignored" }
  | { outcome: "unknown" }
  | { outcome: "paid"; order: string; payment: "PAID_ONLINE" | "REFUND_REQUIRED" }
  | { outcome: "mismatch"; order: string }
  | { outcome: "failed"; order: string };

export async function recordCheckoutSession(
  input: { order: string; sessionId: string; url: string | null; cents: number }, db?: Db,
) {
  const connection = db ?? await database();
  await connection.query(`
    INSERT INTO payment_attempts (order_number, provider, provider_session_id, checkout_url, amount_cents)
    VALUES ($1, 'stripe', $2, $3, $4) ON CONFLICT (provider_session_id) DO NOTHING
  `, [input.order, input.sessionId, input.url, input.cents]);
}

export async function openCheckoutUrl(order: string, db?: Db) {
  const connection = db ?? await database();
  const { rows } = await connection.query<{ checkout_url: string | null }>(
    "SELECT checkout_url FROM payment_attempts WHERE order_number = $1 AND status = 'CREATED' ORDER BY id DESC LIMIT 1", [order]);
  return rows[0]?.checkout_url ?? null;
}

/** Cancels an order that never reached payment so its pickup slot is released. */
export async function abandonUnpaidOrder(order: string, db?: Db) {
  const connection = db ?? await database();
  await connection.query(`
    WITH changed AS (
      UPDATE orders SET status = 'CANCELLED', payment = 'PAYMENT_FAILED'
      WHERE number = $1 AND status = 'RECEIVED' AND payment = 'UNPAID' RETURNING number
    ) INSERT INTO order_events (order_number, status) SELECT number, 'CANCELLED' FROM changed
  `, [order]);
}

/**
 * Applies a signature-verified Stripe event. Every step happens in one statement, so recording the
 * event id and updating the ledger/order are atomic and a replay changes nothing.
 */
export async function applyStripeEvent(event: Stripe.Event, db?: Db): Promise<Reconciliation> {
  const connection = db ?? await database();
  if (event.livemode && process.env.STRIPE_MODE !== "live") return { outcome: "ignored" };
  const paid = event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded";
  const failed = event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed";
  if (!paid && !failed) return { outcome: "ignored" };
  const session = event.data.object as Stripe.Checkout.Session;
  if (session.mode !== "payment" || !session.id) return { outcome: "ignored" };
  // A completed session may still be unpaid (delayed methods); only `paid` settles the order.
  if (paid && session.payment_status !== "paid") return { outcome: "ignored" };

  type Row = { first_seen: number; attempt_order: string | null; attempt_status: string | null; payment: string | null };
  const { rows: [row] } = await connection.query<Row>(`
    WITH seen AS (
      INSERT INTO provider_events (provider, event_id, type)
      SELECT 'stripe', $1, $2 WHERE EXISTS (SELECT 1 FROM payment_attempts WHERE provider_session_id = $7)
      ON CONFLICT DO NOTHING RETURNING event_id
    ), attempt AS (
      UPDATE payment_attempts a SET updated_at = now(), status = CASE
        WHEN $5::boolean THEN (CASE WHEN a.amount_cents = $3::int AND lower($4) = a.currency
                                         AND a.order_number::text = $6 THEN 'PAID' ELSE 'MISMATCH' END)
        WHEN $2 = 'checkout.session.expired' THEN 'EXPIRED' ELSE 'FAILED' END
      WHERE a.provider_session_id = $7 AND a.status = 'CREATED' AND EXISTS (SELECT 1 FROM seen)
      RETURNING a.order_number, a.status
    ), settled AS (
      UPDATE orders o SET payment = CASE WHEN o.status = 'CANCELLED' THEN 'REFUND_REQUIRED' ELSE 'PAID_ONLINE' END
      FROM attempt WHERE o.number = attempt.order_number AND attempt.status = 'PAID'
        AND o.payment IN ('UNPAID', 'PAYMENT_FAILED') RETURNING o.number, o.payment
    ), released AS (
      UPDATE orders o SET status = 'CANCELLED', payment = 'PAYMENT_FAILED'
      FROM attempt WHERE o.number = attempt.order_number AND attempt.status IN ('EXPIRED', 'FAILED')
        AND o.status = 'RECEIVED' AND o.payment = 'UNPAID' RETURNING o.number
    ), history AS (
      INSERT INTO order_events (order_number, status) SELECT number, 'CANCELLED' FROM released
    )
    SELECT (SELECT count(*)::int FROM seen) AS first_seen,
           (SELECT order_number::text FROM attempt) AS attempt_order,
           (SELECT status FROM attempt) AS attempt_status,
           (SELECT payment FROM settled) AS payment
  `, [event.id, event.type, session.amount_total ?? 0, session.currency ?? "", paid,
    session.client_reference_id ?? "", session.id]);
  if (!row.first_seen) {
    const { rows: known } = await connection.query("SELECT 1 FROM provider_events WHERE provider = 'stripe' AND event_id = $1", [event.id]);
    // Unknown session and unseen event: ask Stripe to retry once our ledger row exists.
    return known.length ? { outcome: "replay" } : { outcome: "unknown" };
  }
  if (!row.attempt_order || !row.attempt_status) return { outcome: "ignored" };
  if (row.attempt_status === "MISMATCH") return { outcome: "mismatch", order: row.attempt_order };
  if (row.attempt_status === "PAID") {
    return { outcome: "paid", order: row.attempt_order, payment: (row.payment ?? "PAID_ONLINE") as "PAID_ONLINE" };
  }
  return { outcome: "failed", order: row.attempt_order };
}
