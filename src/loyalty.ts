import { createHash, randomBytes } from "node:crypto";
import { database } from "./db";
import { pointsFor, returnPercent, rewardState, type RewardState } from "./rewards-math";

export { pointsFor };

type Db = { query<T extends Record<string, unknown>>(sql: string, args?: unknown[]): Promise<{ rows: T[] }> };

export const loyaltyErrors = ["ACCOUNT_NOT_FOUND", "IDEMPOTENCY_CONFLICT", "ACCOUNT_SUSPENDED", "INSUFFICIENT_POINTS",
  "QR_INVALID", "QR_USED", "QR_EXPIRED", "PROGRAM_INACTIVE", "REWARD_UNAVAILABLE", "ACCRUAL_DISABLED", "REDEMPTION_DISABLED",
  "NO_EARN_FOR_ORDER", "REFUND_EXCEEDS_PURCHASE", "GUEST_NOT_FOUND", "NOT_AUTHORIZED"] as const;
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

export type Program = {
  active: boolean; pointsPerDollar: number | null; earnCategories: string[] | null; minOrderCents: number;
  previewVisible: boolean; accrualEnabled: boolean; redemptionEnabled: boolean; commercialAuthorized: boolean;
};
export type Account = { id: string; user_id: string | null; member_code: string; balance: number; lifetime_earned: number; status: "active" | "suspended" | "merged"; enrolled_at: Date | string };
export type Reward = { id: string; name_fr: string; name_en: string; description_fr: string; description_en: string; points_cost: number; available: boolean; eligible_category: string | null; eligible_product_id: string | null; discount_cents: number | null; preview_visible: boolean };

/** The five lifecycle states, kept separate on purpose. */
export function programStages(program: Program) {
  return {
    configured: program.pointsPerDollar !== null,
    previewVisible: program.previewVisible,
    accrualOperational: program.active && program.accrualEnabled && program.pointsPerDollar !== null,
    redemptionOperational: program.active && program.redemptionEnabled,
    commercialAuthorized: program.commercialAuthorized,
  };
}

export async function loyaltyProgram(db?: Db): Promise<Program> {
  const { rows: [row] } = await (db ?? await database()).query<{ active: boolean; points_per_dollar: number | null; earn_categories: string[] | null; min_order_cents: number;
    preview_visible: boolean; accrual_enabled: boolean; redemption_enabled: boolean; commercial_authorized: boolean }>(
    "SELECT active, points_per_dollar, earn_categories, min_order_cents, preview_visible, accrual_enabled, redemption_enabled, commercial_authorized FROM loyalty_program WHERE id = 1");
  return { active: row.active, pointsPerDollar: row.points_per_dollar, earnCategories: row.earn_categories, minOrderCents: row.min_order_cents,
    previewVisible: row.preview_visible, accrualEnabled: row.accrual_enabled, redemptionEnabled: row.redemption_enabled, commercialAuthorized: row.commercial_authorized };
}

/**
 * Everything the public page may show: program terms and reward definitions. By construction it carries no account,
 * member, order or personal data.
 */
export type PublicReward = { id: string; nameFr: string; nameEn: string; descriptionFr: string; descriptionEn: string; pointsCost: number; discountCents: number | null; state: RewardState };
export type PublicRewards = {
  previewVisible: boolean; operational: boolean; accrualOperational: boolean; redemptionOperational: boolean;
  pointsPerDollar: number | null; minOrderCents: number; categoryRestricted: boolean; percent: number | null;
  featured: PublicReward | null; rewards: PublicReward[];
};
export async function publicRewards(db?: Db): Promise<PublicRewards> {
  const connection = db ?? await database();
  const program = await loyaltyProgram(connection);
  const stages = programStages(program);
  const { rows } = await connection.query<Reward>("SELECT * FROM loyalty_rewards WHERE preview_visible ORDER BY points_cost, id");
  const rewards = rows.map<PublicReward>(r => ({ id: r.id, nameFr: r.name_fr, nameEn: r.name_en, descriptionFr: r.description_fr, descriptionEn: r.description_en,
    pointsCost: r.points_cost, discountCents: r.discount_cents, state: rewardState(r, { active: program.active, redemptionOperational: stages.redemptionOperational }) }));
  const featured = rewards.find(r => r.discountCents !== null) ?? null;
  return { previewVisible: program.previewVisible, operational: program.active, accrualOperational: stages.accrualOperational, redemptionOperational: stages.redemptionOperational,
    pointsPerDollar: program.pointsPerDollar, minOrderCents: program.minOrderCents, categoryRestricted: Boolean(program.earnCategories?.length),
    percent: featured?.discountCents ? returnPercent(program.pointsPerDollar, { pointsCost: featured.pointsCost, discountCents: featured.discountCents }) : null, featured, rewards };
}

/** Rewards a customer could redeem right now. Empty when the program is inactive. */
export async function availableRewards(db?: Db) {
  return (await (db ?? await database()).query<Reward>(`
    SELECT r.* FROM loyalty_rewards r WHERE r.available AND (SELECT active AND redemption_enabled FROM loyalty_program WHERE id = 1) ORDER BY r.points_cost, r.id`)).rows;
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
  const { rows: [row] } = await (db ?? await database()).query<{ account_id: string; member_code: string; balance: number; status: string; name: string | null; expires_at: Date | string }>(`
    SELECT a.id AS account_id, a.member_code, a.balance, a.status, u."name", t.expires_at
    FROM loyalty_qr_tokens t JOIN loyalty_accounts a ON a.id = t.account_id LEFT JOIN "user" u ON u."id" = a.user_id
    WHERE t.token_hash = $1 AND t.redeemed_at IS NULL AND t.expires_at > now()`, [hashToken(token)]);
  return row && { accountId: row.account_id, memberCode: row.member_code, balance: row.balance, status: row.status,
    firstName: row.name ? row.name.trim().split(/\s+/)[0] : null, guest: row.name === null, expiresAt: new Date(row.expires_at).toISOString() };
}

export async function redeemReward(input: { token: string; rewardId: string; key: string; actor: string }, db?: Db) {
  if (!/^[0-9a-f]{64}$/.test(input.token)) throw new LoyaltyError("QR_INVALID");
  try {
    const { rows: [row] } = await (db ?? await database()).query<{ o_duplicate: boolean; o_balance: number; o_txn: string; o_reward: string }>(
      "SELECT * FROM loyalty_redeem($1, $2, $3, $4)", [hashToken(input.token), input.rewardId, input.key, input.actor]);
    return { duplicate: row.o_duplicate, balance: row.o_balance, reward: row.o_reward };
  } catch (error) { return coded(error); }
}

async function post(account: string, kind: "earn" | "adjust", points: number, key: string, extra: { order?: string | null; reason?: string | null; actor: string; eligible?: number | null }, db?: Db) {
  try {
    const { rows: [row] } = await (db ?? await database()).query<{ o_duplicate: boolean; o_balance: number }>(
      "SELECT * FROM loyalty_post($1, $2, $3, $4, $5, NULL, NULL, $6, $7, $8)", [account, kind, points, key, extra.order ?? null, extra.reason ?? null, extra.actor, extra.eligible ?? null]);
    return { duplicate: row.o_duplicate, balance: row.o_balance };
  } catch (error) { return coded(error); }
}

/** Awards points for a completed online order. Safe to call repeatedly: one earn per order. */
export async function earnForOrder(orderNumber: string, db?: Db) {
  const connection = db ?? await database();
  const program = await loyaltyProgram(connection);
  if (!programStages(program).accrualOperational || !program.pointsPerDollar) return { awarded: 0 };
  const { rows: [order] } = await connection.query<{ customer_user_id: string | null; loyalty_account_id: string | null; status: string; items: { product: string; subtotal: number }[] }>(
    "SELECT customer_user_id, loyalty_account_id, status, items FROM orders WHERE number = $1", [orderNumber]);
  // Only COMPLETED orders earn: cancelled or unfinished orders never do. Items carry pre-tax subtotals, so tax is excluded.
  if (!order || order.status !== "COMPLETED" || (!order.customer_user_id && !order.loyalty_account_id)) return { awarded: 0 };
  const account = order.customer_user_id ? await accountForUser(order.customer_user_id, connection)
    : (await connection.query<Account>("SELECT * FROM loyalty_accounts WHERE id = $1", [order.loyalty_account_id])).rows[0];
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
  const result = await post(account.id, "earn", points, `earn:order:${orderNumber}`, { order: orderNumber, actor: "system", eligible }, connection);
  return { awarded: result.duplicate ? 0 : points };
}

/** In-store purchase awarded by staff after QR identification. Same rule as online earning. */
export async function awardInStore(input: { accountId: string; cents: number; key: string; actor: string }, db?: Db) {
  const connection = db ?? await database();
  const program = await loyaltyProgram(connection);
  if (!program.active || !program.pointsPerDollar) throw new LoyaltyError("PROGRAM_INACTIVE");
  if (!program.accrualEnabled) throw new LoyaltyError("ACCRUAL_DISABLED");
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


/** Reverses points after a refund of the pre-tax purchase amount. Idempotent per key; never drives a balance negative. */
export async function reverseForRefund(input: { order: string; refundCents: number; reason: string; key: string; actor: string }, db?: Db) {
  const reason = input.reason.trim();
  if (!/^[1-9]\d{0,17}$/.test(input.order) || !Number.isSafeInteger(input.refundCents) || input.refundCents < 1 || reason.length < 3 || reason.length > 280) throw new LoyaltyError("FAILED");
  try {
    const { rows: [row] } = await (db ?? await database()).query<{ o_duplicate: boolean; o_reversed: number; o_shortfall: number; o_balance: number }>(
      "SELECT * FROM loyalty_reverse_refund($1, $2, $3, $4, $5)", [input.order, input.refundCents, input.key, reason, input.actor]);
    return { duplicate: row.o_duplicate, reversed: row.o_reversed, shortfall: row.o_shortfall, balance: row.o_balance };
  } catch (error) { return coded(error); }
}

const guestHash = hashToken;
/** Creates a guest card. The secret is returned once; only its SHA-256 hash is stored. */
export async function createGuestCard(db?: Db) {
  const connection = db ?? await database();
  const secret = randomBytes(32).toString("hex");
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = Array.from(randomBytes(8), byte => alphabet[byte % alphabet.length]).join("");
    try {
      const { rows: [account] } = await connection.query<Account>(
        "INSERT INTO loyalty_accounts (user_id, member_code, guest_secret_hash) VALUES (NULL, $1, $2) RETURNING *", [code, guestHash(secret)]);
      return { secret, account };
    } catch (error) {
      if ((error as { code?: string }).code !== "23505" || attempt === 5) throw error;
    }
  }
  throw new Error("unreachable");
}
export async function guestAccount(secret: string, db?: Db) {
  if (!/^[0-9a-f]{64}$/.test(secret)) return undefined;
  return (await (db ?? await database()).query<Account>(
    "SELECT * FROM loyalty_accounts WHERE guest_secret_hash = $1 AND user_id IS NULL AND status <> 'merged'", [guestHash(secret)])).rows[0];
}
/** Moves a guest card into the customer's account (atomic and idempotent: a second attempt fails and moves nothing). */
export async function linkGuestCard(secret: string, userId: string, db?: Db) {
  if (!/^[0-9a-f]{64}$/.test(secret)) throw new LoyaltyError("GUEST_NOT_FOUND");
  try {
    const { rows: [row] } = await (db ?? await database()).query<{ o_account: string; o_moved: number }>("SELECT * FROM loyalty_link_guest($1, $2)", [guestHash(secret), userId]);
    return { accountId: row.o_account, moved: row.o_moved };
  } catch (error) { return coded(error); }
}
/** Attaches an online order to a guest card. Only orders with no member and no card yet can be attached. */
export async function linkOrderToCard(orderNumber: string, accountId: string, db?: Db) {
  await (db ?? await database()).query(
    "UPDATE orders SET loyalty_account_id = $2 WHERE number = $1 AND customer_user_id IS NULL AND loyalty_account_id IS NULL", [orderNumber, accountId]);
}

/** Points confirmed for one order (earn minus reversals), or undefined when none were credited. */
export async function pointsForOrder(orderNumber: string, db?: Db) {
  const { rows: [row] } = await (db ?? await database()).query<{ points: number | null }>(
    "SELECT sum(points)::int AS points FROM loyalty_transactions WHERE order_number = $1 AND kind IN ('earn', 'reverse')", [orderNumber]);
  return row?.points ?? undefined;
}

export type ProgramInput = {
  active: boolean; rate: number | null; minOrderCents: number; categories: string[];
  previewVisible: boolean; accrualEnabled: boolean; redemptionEnabled: boolean; commercialAuthorized: boolean;
};
/** Validates and saves the program configuration with an audit entry. `production` blocks activation without authorization. */
export async function saveProgramConfig(input: ProgramInput, actor: string, options: { production: boolean }, db?: Db) {
  if (input.rate !== null && (!Number.isInteger(input.rate) || input.rate < 1 || input.rate > 100)) throw new LoyaltyError("FAILED");
  if (!Number.isInteger(input.minOrderCents) || input.minOrderCents < 0 || input.minOrderCents > 1_000_000) throw new LoyaltyError("FAILED");
  // An unconfigured program can never be operational, and production operation needs the owner's recorded authorization.
  if (input.active && input.rate === null) throw new LoyaltyError("PROGRAM_INACTIVE");
  if (input.active && options.production && !input.commercialAuthorized) throw new LoyaltyError("NOT_AUTHORIZED");
  await (db ?? await database()).query(`
    WITH before AS (SELECT commercial_authorized FROM loyalty_program WHERE id = 1),
    saved AS (
      UPDATE loyalty_program SET active = $1, points_per_dollar = $2,
        earn_categories = (SELECT CASE WHEN count(*) = 0 THEN NULL ELSE array_agg(id) END FROM catalog_categories WHERE id = ANY($3::text[])),
        min_order_cents = $4, preview_visible = $6, accrual_enabled = $7, redemption_enabled = $8, commercial_authorized = $9,
        commercial_authorized_at = CASE WHEN $9::boolean AND NOT (SELECT commercial_authorized FROM before) THEN now()
          WHEN NOT $9::boolean THEN NULL ELSE commercial_authorized_at END,
        commercial_authorized_by = CASE WHEN $9::boolean AND NOT (SELECT commercial_authorized FROM before) THEN $5
          WHEN NOT $9::boolean THEN NULL ELSE commercial_authorized_by END,
        updated_at = now(), updated_by = $5
      WHERE id = 1 RETURNING active, points_per_dollar, earn_categories, min_order_cents, preview_visible, accrual_enabled, redemption_enabled, commercial_authorized
    ) INSERT INTO catalog_audit_history (action, subject, details) SELECT 'loyalty.program', 'program', to_jsonb(saved) || jsonb_build_object('actor', $5::text) FROM saved
  `, [input.active, input.rate, input.categories, input.minOrderCents, actor, input.previewVisible, input.accrualEnabled, input.redemptionEnabled, input.commercialAuthorized]);
}
