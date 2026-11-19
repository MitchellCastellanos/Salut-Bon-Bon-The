import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { businessSnapshot, computeTax, getBusinessProfile, getFiscalSettings } from "./business";
import { quoteOfficial } from "./catalog-pricing";
import { database } from "./db";
import { earnForOrder } from "./loyalty";

export const tenders = ["cash", "terminal", "other"] as const;
const counterLine = z.object({
  product: z.string().regex(/^[a-zA-Z0-9-]{1,64}$/), size: z.enum(["regular", "large"]),
  quantity: z.number().int().min(1).max(20), optionIds: z.array(z.string().min(1).max(64)).max(18),
});
export const counterSchema = z.object({
  request: z.uuid(),
  name: z.string().trim().max(80),
  tender: z.enum(tenders),
  member: z.string().trim().max(254),
  lines: z.array(counterLine).min(1).max(30),
});

export class CounterError extends Error {
  constructor(readonly code: "FISCAL" | "MENU" | "MEMBER" | "CONFLICT") { super(code); }
}

/** Resolves a loyalty account by member code or email. Returns undefined when nothing matches. */
export async function findMember(query: string) {
  const q = query.trim();
  if (!q) return undefined;
  const { rows: [row] } = await (await database()).query<{ id: string; user_id: string; status: string }>(
    `SELECT a.id, a.user_id, a.status FROM loyalty_accounts a JOIN "user" u ON u.id = a.user_id
     WHERE a.member_code = upper($1) OR lower(u."email") = lower($1) LIMIT 1`, [q]);
  return row;
}

/**
 * Records a sale made in person: priced and taxed on the server like an online order, stored as already paid and completed,
 * kept out of pickup capacity, and linked to a loyalty account when one is named (points are then earned by the usual rule).
 * Idempotent per `request`.
 */
export async function placeCounterOrder(raw: z.infer<typeof counterSchema>, actor: string) {
  const input = counterSchema.parse(raw);
  const fingerprint = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const db = await database();
  const prior = (await db.query<{ number: string; tracking_token: string; request_fingerprint: string }>(
    "SELECT number::text AS number, tracking_token, request_fingerprint FROM orders WHERE request_id = $1", [input.request])).rows[0];
  if (prior) {
    if (prior.request_fingerprint !== fingerprint) throw new CounterError("CONFLICT");
    return { number: prior.number, token: prior.tracking_token, awarded: 0 };
  }
  const [fiscal, profile] = await Promise.all([getFiscalSettings(db), getBusinessProfile(db)]);
  if (fiscal.status === "unconfigured") throw new CounterError("FISCAL");
  const member = input.member ? await findMember(input.member) : undefined;
  if (input.member && !member) throw new CounterError("MEMBER");
  let items;
  try {
    items = await quoteOfficial(input.lines.map(line => ({ ...line, sugar: "100" as const, ice: "100" as const, topping: "none" as const })), true);
  } catch { throw new CounterError("MENU"); }
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const { cents: tax, lines: taxLines } = computeTax(subtotal, fiscal);
  const snapshot = profile ? businessSnapshot(profile, fiscal) : null;
  const token = randomBytes(32).toString("hex");
  const { rows: [order] } = await db.query<{ number: string }>(`
    WITH ins AS (
      INSERT INTO orders (request_id, request_fingerprint, tracking_token, locale, customer, notes, pickup_at, items, total, payment, status,
        tax_cents, payment_method, customer_user_id, loyalty_account_id, tax_breakdown, business_snapshot, channel, counter_tender, created_by)
      VALUES ($1, $2, $3, 'fr', $4, '', now(), $5, $6, 'PAID_AT_PICKUP', 'COMPLETED', $7, 'pickup', $8, $9, $10, $11, 'COUNTER', $12, $13)
      ON CONFLICT (request_id) DO NOTHING
      RETURNING number
    ), events AS (
      INSERT INTO order_events (order_number, status) SELECT number, s FROM ins, unnest(ARRAY['RECEIVED', 'COMPLETED']) AS s
    ) SELECT number::text AS number FROM ins`, [
    input.request, fingerprint, token, input.name || "Comptoir", JSON.stringify(items), subtotal + tax, tax,
    member?.user_id ?? null, member?.id ?? null, JSON.stringify(taxLines), snapshot ? JSON.stringify(snapshot) : null, input.tender, actor.slice(0, 64)]);
  if (!order) throw new CounterError("CONFLICT"); // a concurrent request with the same id won; retrying returns that receipt
  const earned = member ? await earnForOrder(order.number).catch(() => ({ awarded: 0 })) : { awarded: 0 };
  return { number: order.number, token, awarded: earned.awarded, total: subtotal + tax, tax };
}
