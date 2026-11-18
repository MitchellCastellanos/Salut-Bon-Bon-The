import { createHash, randomBytes } from "node:crypto";
import { database } from "./db";

type Db = { query<T extends Record<string, unknown>>(sql: string, args?: unknown[]): Promise<{ rows: T[] }> };

export const loyaltyErrors = ["ACCOUNT_NOT_FOUND", "IDEMPOTENCY_CONFLICT", "ACCOUNT_SUSPENDED", "INSUFFICIENT_POINTS",
  "QR_INVALID", "QR_USED", "QR_EXPIRED", "PROGRAM_INACTIVE", "REWARD_UNAVAILABLE"] as const;
export type LoyaltyErrorCode = typeof loyaltyErrors[number] | "FAILED";

export class LoyaltyError extends Error {
  constructor(public code: LoyaltyErrorCode) { super(code); }
}
function coded(error: unknown): never {
  const message = error instanceof Error ? error.message : "";
  throw new LoyaltyError((loyaltyErrors as readonly string[]).includes(message) ? message as LoyaltyErrorCode : "FAILED");
}

export const qrLifetimeSeconds = 300;
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const pointsFor = (eligibleCents: number, perDollar: number) => Math.floor(eligibleCents * perDollar / 100);

export type Program = { active: boolean; pointsPerDollar: number | null; earnCategories: string[] | null; minOrderCents: number };
export type Account = { id: string; user_id: string; member_code: string; balance: number; lifetime_earned: number; status: "active" | "suspended"; enrolled_at: Date | string };
export type Reward = { id: string; name_fr: string; name_en: string; description_fr: string; description_en: string; points_cost: number; available: boolean; eligible_category: string | null; eligible_product_id: string | null };

export async function loyaltyProgram(db?: Db): Promise<Program> {
  const { rows: [row] } = await (db ?? await database()).query<{ active: boolean; points_per_dollar: number | null; earn_categories: string[] | null; min_order_cents: number }>(
    "SELECT active, points_per_dollar, earn_categories, min_order_cents FROM loyalty_program WHERE id = 1");
  return { active: row.active, pointsPerDollar: row.points_per_dollar, earnCategories: row.earn_categories, minOrderCents: row.min_order_cents };
}

/** Rewards a customer could redeem right now. Empty when the program is inactive. */
export async function availableRewards(db?: Db) {
  return (await (db ?? await database()).query<Reward>(`
    SELECT r.* FROM loyalty_rewards r WHERE r.available AND (SELECT active FROM loyalty_program WHERE id = 1) ORDER BY r.points_cost, r.id`)).rows;
}

export async function accountForUser(userId: string, db?: Db) {
  return (await (db ?? await database()).query<Account>("SELECT * FROM loyalty_accounts WHERE user_id = $1", [userId])).rows[0];
}

/** Idempotent: enrolling twice returns the same account and member code. */
export async function enroll(userId: string, db?: Db) {
  const connection = db ?? await database();
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = Array.from(randomBytes(8), byte => alphabet[byte % alphabet.length]).join("");
    try {
      const { rows: [account] } = await connection.query<Account>(`
        INSERT INTO loyalty_accounts (user_id, member_code) VALUES ($1, $2)
        ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id RETURNING *`, [userId, code]);
      return account;
    } catch (error) {
      if ((error as { code?: string }).code !== "23505" || attempt === 5) throw error; // member_code collision: retry
    }
  }
  throw new Error("unreachable");
}

/** Issues a fresh single-use identification token and invalidates the previous unredeemed one. */
export async function issueQr(accountId: string, db?: Db) {
  const connection = db ?? await database();
  const token = randomBytes(32).toString("hex");
  await connection.query("UPDATE loyalty_qr_tokens SET expires_at = now() WHERE account_id = $1 AND redeemed_at IS NULL AND expires_at > now()", [accountId]);
  const { rows: [row] } = await connection.query<{ expires_at: Date | string }>(`
    INSERT INTO loyalty_qr_tokens (account_id, token_hash, expires_at) VALUES ($1, $2, now() + make_interval(secs => $3::int)) RETURNING expires_at`,
    [accountId, hashToken(token), qrLifetimeSeconds]);
  return { token, expiresAt: new Date(row.expires_at).toISOString() };
}

/** Identification only (does not consume the token). Reveals first name, member code and balance. */
export async function lookupQr(token: string, db?: Db) {
  if (!/^[0-9a-f]{64}$/.test(token)) return undefined;
  const { rows: [row] } = await (db ?? await database()).query<{ account_id: string; member_code: string; balance: number; status: string; name: string; expires_at: Date | string }>(`
    SELECT a.id AS account_id, a.member_code, a.balance, a.status, u."name", t.expires_at
    FROM loyalty_qr_tokens t JOIN loyalty_accounts a ON a.id = t.account_id JOIN "user" u ON u."id" = a.user_id
    WHERE t.token_hash = $1 AND t.redeemed_at IS NULL AND t.expires_at > now()`, [hashToken(token)]);
  return row && { accountId: row.account_id, memberCode: row.member_code, balance: row.balance, status: row.status,
    firstName: row.name.trim().split(/\s+/)[0], expiresAt: new Date(row.expires_at).toISOString() };
}

export async function redeemReward(input: { token: string; rewardId: string; key: string; actor: string }, db?: Db) {
  if (!/^[0-9a-f]{64}$/.test(input.token)) throw new LoyaltyError("QR_INVALID");
  try {
    const { rows: [row] } = await (db ?? await database()).query<{ o_duplicate: boolean; o_balance: number; o_txn: string; o_reward: string }>(
      "SELECT * FROM loyalty_redeem($1, $2, $3, $4)", [hashToken(input.token), input.rewardId, input.key, input.actor]);
    return { duplicate: row.o_duplicate, balance: row.o_balance, reward: row.o_reward };
  } catch (error) { return coded(error); }
}

async function post(account: string, kind: "earn" | "adjust", points: number, key: string, extra: { order?: string | null; reason?: string | null; actor: string }, db?: Db) {
  try {
    const { rows: [row] } = await (db ?? await database()).query<{ o_duplicate: boolean; o_balance: number }>(
      "SELECT * FROM loyalty_post($1, $2, $3, $4, $5, NULL, NULL, $6, $7)", [account, kind, points, key, extra.order ?? null, extra.reason ?? null, extra.actor]);
    return { duplicate: row.o_duplicate, balance: row.o_balance };
  } catch (error) { return coded(error); }
}

/** Awards points for a completed online order. Safe to call repeatedly: one earn per order. */
export async function earnForOrder(orderNumber: string, db?: Db) {
  const connection = db ?? await database();
  const program = await loyaltyProgram(connection);
  if (!program.active || !program.pointsPerDollar) return { awarded: 0 };
  const { rows: [order] } = await connection.query<{ customer_user_id: string | null; status: string; items: { product: string; subtotal: number }[] }>(
    "SELECT customer_user_id, status, items FROM orders WHERE number = $1", [orderNumber]);
  if (!order?.customer_user_id || order.status !== "COMPLETED") return { awarded: 0 };
  const account = await accountForUser(order.customer_user_id, connection);
  if (!account || account.status !== "active") return { awarded: 0 };
  let eligible = order.items.reduce((sum, item) => sum + item.subtotal, 0);
  if (program.earnCategories) {
    const { rows } = await connection.query<{ id: string }>("SELECT id FROM catalog_products WHERE id = ANY($1::text[]) AND category = ANY($2::text[])",
      [order.items.map(item => item.product), program.earnCategories]);
    const ids = new Set(rows.map(row => row.id));
    eligible = order.items.filter(item => ids.has(item.product)).reduce((sum, item) => sum + item.subtotal, 0);
  }
  const total = order.items.reduce((sum, item) => sum + item.subtotal, 0);
  const points = total >= program.minOrderCents ? pointsFor(eligible, program.pointsPerDollar) : 0;
  if (points <= 0) return { awarded: 0 };
  const result = await post(account.id, "earn", points, `earn:order:${orderNumber}`, { order: orderNumber, actor: "system" }, connection);
  return { awarded: result.duplicate ? 0 : points };
}

/** In-store purchase awarded by staff after QR identification. Same rule as online earning. */
export async function awardInStore(input: { accountId: string; cents: number; key: string; actor: string }, db?: Db) {
  const connection = db ?? await database();
  const program = await loyaltyProgram(connection);
  if (!program.active || !program.pointsPerDollar) throw new LoyaltyError("PROGRAM_INACTIVE");
  if (!Number.isSafeInteger(input.cents) || input.cents < 1 || input.cents > 500000) throw new LoyaltyError("FAILED");
  const points = pointsFor(input.cents, program.pointsPerDollar);
  if (points <= 0 || input.cents < program.minOrderCents) return { duplicate: false, balance: undefined, awarded: 0 };
  return { ...await post(input.accountId, "earn", points, input.key, { actor: input.actor }, connection), awarded: points };
}

/** ADMIN correction. A reason is mandatory and the entry is permanent history. */
export async function adjustPoints(input: { accountId: string; points: number; reason: string; key: string; actor: string }, db?: Db) {
  const reason = input.reason.trim();
  if (!Number.isInteger(input.points) || input.points === 0 || Math.abs(input.points) > 100000 || reason.length < 3) throw new LoyaltyError("FAILED");
  return post(input.accountId, "adjust", input.points, input.key, { reason, actor: input.actor }, db);
}

export async function accountHistory(accountId: string, limit = 50, db?: Db) {
  return (await (db ?? await database()).query<{ id: string; kind: string; points: number; balance_after: number; reward_name: string | null; reason: string | null; order_number: string | null; actor: string; created_at: Date | string }>(
    `SELECT id::text, kind, points, balance_after, reward_name, reason, order_number::text, actor, created_at
     FROM loyalty_transactions WHERE account_id = $1 ORDER BY id DESC LIMIT $2`, [accountId, limit])).rows;
}
