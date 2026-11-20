import { database } from "./db";
import { LoyaltyError, reverseForRefund } from "./loyalty";
import { refundCheckoutSession, stripeMode } from "./providers/stripe";

type Db = { query<T extends Record<string, unknown>>(sql: string, args?: unknown[]): Promise<{ rows: T[] }> };

export class RefundError extends Error {
  constructor(public code: "NOT_FOUND" | "NOT_REFUNDABLE" | "AMOUNT" | "PROVIDER_UNAVAILABLE" | "PROVIDER_FAILED") { super(code); }
}

/**
 * ADMIN refund of a paid order, in whole cents including tax, with a mandatory reason. Simulated payments are refunded in the simulation,
 * Stripe payments through the Stripe API (only when Stripe credentials are connected), pay-at-pickup payments are recorded as manual
 * refunds. Idempotent per key, never above what was paid, written to the audit history, and the stamps earned on the order are taken
 * back in proportion to the pre-tax amount refunded.
 */
export async function refundOrder(input: { order: string; amountCents: number; reason: string; key: string; actor: string }, db?: Db) {
  const connection = db ?? await database();
  const reason = input.reason.trim();
  if (!/^[1-9]\d{0,17}$/.test(input.order) || !Number.isSafeInteger(input.amountCents) || input.amountCents < 1 || reason.length < 3 || reason.length > 280 || input.key.length < 8) throw new RefundError("AMOUNT");
  const { rows: [order] } = await connection.query<{ total: number; tax_cents: number; payment: string; payment_method: string; refunded: number }>(`
    SELECT o.total, o.tax_cents, o.payment, o.payment_method, coalesce((SELECT sum(amount_cents) FROM order_refunds r WHERE r.order_number = o.number), 0)::int AS refunded
    FROM orders o WHERE o.number = $1`, [input.order]);
  if (!order) throw new RefundError("NOT_FOUND");
  const { rows: [prior] } = await connection.query<{ amount_cents: number; order_number: string }>("SELECT amount_cents, order_number::text FROM order_refunds WHERE idempotency_key = $1", [input.key]);
  if (prior) {
    if (prior.order_number !== input.order || prior.amount_cents !== input.amountCents) throw new RefundError("AMOUNT");
    return { duplicate: true, refundedCents: order.refunded, full: order.refunded >= order.total };
  }
  if (!["PAID_ONLINE", "REFUND_REQUIRED", "PAID_AT_PICKUP"].includes(order.payment)) throw new RefundError("NOT_REFUNDABLE");
  if (input.amountCents > order.total - order.refunded) throw new RefundError("AMOUNT");
  const { rows: [attempt] } = await connection.query<{ provider: string; provider_session_id: string }>(
    "SELECT provider, provider_session_id FROM payment_attempts WHERE order_number = $1 AND status = 'PAID' ORDER BY id DESC LIMIT 1", [input.order]);
  let provider: "simulated" | "stripe" | "manual" = "manual", ref: string | null = null;
  if (order.payment_method === "card" && attempt) {
    if (attempt.provider === "simulated") { provider = "simulated"; ref = `sim_re_${input.key.slice(0, 24)}`; }
    else {
      if (stripeMode() === "disabled") throw new RefundError("PROVIDER_UNAVAILABLE");
      provider = "stripe";
      try { ref = await refundCheckoutSession(attempt.provider_session_id, input.amountCents, input.key); } catch { throw new RefundError("PROVIDER_FAILED"); }
    }
  }
  const total = order.refunded + input.amountCents, full = total >= order.total;
  await connection.query(`
    WITH saved AS (
      INSERT INTO order_refunds (order_number, amount_cents, reason, provider, provider_ref, idempotency_key, actor)
      VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (idempotency_key) DO NOTHING RETURNING order_number, amount_cents, provider
    ), settled AS (UPDATE orders SET payment = 'REFUNDED' WHERE number = $1 AND $8::boolean AND EXISTS (SELECT 1 FROM saved) RETURNING number)
    INSERT INTO catalog_audit_history (action, subject, details)
    SELECT 'order.refund', order_number::text, jsonb_build_object('amountCents', amount_cents, 'provider', provider, 'reason', $3::text, 'actor', $7::text) FROM saved
  `, [input.order, input.amountCents, reason, provider, ref, input.key, input.actor, full]);
  // Stamps follow the purchase: take back in proportion to the pre-tax part of this refund (never an error for orders that earned nothing).
  const pretax = Math.floor(input.amountCents * (order.total - order.tax_cents) / order.total);
  if (pretax >= 1) {
    try { await reverseForRefund({ order: input.order, refundCents: pretax, reason: `Refund of order ${input.order}: ${reason}`.slice(0, 280), key: `refund-order:${input.key}`, actor: input.actor }, connection); }
    catch (error) { if (!(error instanceof LoyaltyError) || !["NO_EARN_FOR_ORDER", "REFUND_EXCEEDS_PURCHASE"].includes(error.code)) throw error; }
  }
  return { duplicate: false, refundedCents: total, full };
}
