import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { applyLocalMigrations } from "../src/db";
import * as loyalty from "../src/loyalty";

const db = new PGlite();
const q = async (sql: string, args: unknown[] = []) => (await db.query<Record<string, unknown>>(sql, args)).rows;
beforeAll(async () => {
  await applyLocalMigrations(db);
  await q("INSERT INTO catalog_categories VALUES ('milk-tea','Thé au lait','Milk tea'),('matcha','Matcha','Matcha')");
  await q("INSERT INTO catalog_products (id, category) VALUES ('p1','milk-tea'),('p2','matcha')");
});
afterAll(async () => db.close());

let n = 0;
async function customer(name = "Ana Test") {
  n++;
  const id = randomUUID();
  await q(`INSERT INTO "user" ("id","name","email","role") VALUES ($1,$2,$3,'CUSTOMER')`, [id, name, `c${n}@example.invalid`]);
  return { id, account: await loyalty.enroll(id, db) };
}
const configure = (active: boolean, perDollar: number | null, categories: string[] | null = null, min = 0) =>
  q("UPDATE loyalty_program SET active=$1, points_per_dollar=$2, earn_categories=$3, min_order_cents=$4 WHERE id=1", [active, perDollar, categories, min]);
const reward = (id = "free-drink", cost = 100, available = true) =>
  q(`INSERT INTO loyalty_rewards (id,name_fr,name_en,points_cost,available) VALUES ($1,'Boisson gratuite','Free drink',$2,$3)
     ON CONFLICT (id) DO UPDATE SET points_cost=$2, available=$3`, [id, cost, available]);
async function completedOrder(userId: string | null, items: { product: string; subtotal: number }[]) {
  const [o] = await q(`INSERT INTO orders (request_id,request_fingerprint,tracking_token,locale,customer,notes,pickup_at,items,total,payment,status,customer_user_id)
    VALUES (gen_random_uuid(),'f',$1,'en','T','',now(),$2,$3,'PAID_AT_PICKUP','COMPLETED',$4) RETURNING number::text AS number`,
    [String(++n).padStart(64, "c"), JSON.stringify(items), items.reduce((s, i) => s + i.subtotal, 0), userId]);
  return o.number as string;
}
const fund = (accountId: string, points: number) => loyalty.adjustPoints({ accountId, points, reason: "test funding", key: `fund-${randomUUID()}`, actor: "admin" }, db);

describe("enrollment and safe defaults", () => {
  it("enrolls idempotently with a unique non-secret member code", async () => {
    const a = await customer(); const again = await loyalty.enroll(a.id, db); const b = await customer();
    expect(again.id).toBe(a.account.id);
    expect(a.account.member_code).toMatch(/^[A-Z2-9]{8}$/);
    expect(b.account.member_code).not.toBe(a.account.member_code);
    expect(a.account.balance).toBe(0);
  });
  it("ships inactive with the preview terms and an unoffered reward so nothing can be awarded or redeemed unapproved", async () => {
    const [p] = await q("SELECT active, points_per_dollar, (SELECT count(*) FROM loyalty_rewards)::int AS rewards FROM loyalty_program");
    // Migration 009 seeds the 5 % preview terms (10 points per $1) and one $5 reward, both still inactive.
    expect(p).toEqual({ active: false, points_per_dollar: 10, rewards: 1 });
    expect((await q("SELECT available FROM loyalty_rewards WHERE id = 'rabais-5'"))[0]).toEqual({ available: false });
    const c = await customer();
    const order = await completedOrder(c.id, [{ product: "p1", subtotal: 1000 }]);
    expect(await loyalty.earnForOrder(order, db)).toEqual({ awarded: 0 });
    expect(await loyalty.availableRewards(db)).toEqual([]);
  });
});

describe("earning", () => {
  it("awards by the configured rule once per order and ignores other customers' and guest orders", async () => {
    await configure(true, 2);
    const c = await customer(); const other = await customer();
    const order = await completedOrder(c.id, [{ product: "p1", subtotal: 1250 }]);
    expect(await loyalty.earnForOrder(order, db)).toEqual({ awarded: 25 });   // 1250 cents x 2 points per dollar
    expect(await loyalty.earnForOrder(order, db)).toEqual({ awarded: 0 });    // duplicate event
    expect((await loyalty.accountForUser(c.id, db))!.balance).toBe(25);
    expect((await loyalty.accountForUser(other.id, db))!.balance).toBe(0);
    expect(await loyalty.earnForOrder(await completedOrder(null, [{ product: "p1", subtotal: 1000 }]), db)).toEqual({ awarded: 0 });
  });
  it("honours eligible categories and the minimum order", async () => {
    await configure(true, 1, ["matcha"], 500);
    const c = await customer();
    expect(await loyalty.earnForOrder(await completedOrder(c.id, [{ product: "p1", subtotal: 900 }, { product: "p2", subtotal: 700 }]), db)).toEqual({ awarded: 7 });
    expect(await loyalty.earnForOrder(await completedOrder(c.id, [{ product: "p2", subtotal: 400 }]), db)).toEqual({ awarded: 0 });
    await configure(true, 2);
  });
  it("does nothing when the program is switched off or the order is not completed", async () => {
    const c = await customer();
    const order = await completedOrder(c.id, [{ product: "p1", subtotal: 1000 }]);
    await configure(false, 2);
    expect(await loyalty.earnForOrder(order, db)).toEqual({ awarded: 0 });
    await configure(true, 2);
    await q("UPDATE orders SET status='RECEIVED' WHERE number=$1", [order]);
    expect(await loyalty.earnForOrder(order, db)).toEqual({ awarded: 0 });
  });
  it("awards in-store purchases idempotently", async () => {
    const c = await customer(); const key = `store-${randomUUID()}`;
    expect(await loyalty.awardInStore({ accountId: c.account.id, cents: 800, key, actor: "staff" }, db)).toMatchObject({ awarded: 16, balance: 16 });
    expect(await loyalty.awardInStore({ accountId: c.account.id, cents: 800, key, actor: "staff" }, db)).toMatchObject({ duplicate: true, balance: 16 });
  });
});

describe("QR identification and redemption", () => {
  it("identifies by a short-lived token that reveals only the first name, code and balance", async () => {
    const c = await customer("Marie Tremblay"); await fund(c.account.id, 40);
    const { token } = await loyalty.issueQr(c.account.id, db);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    const found = await loyalty.lookupQr(token, db);
    expect(found).toMatchObject({ firstName: "Marie", balance: 40, memberCode: c.account.member_code });
    expect(JSON.stringify(found)).not.toMatch(/Tremblay|@|password/);
    expect((await q("SELECT token_hash FROM loyalty_qr_tokens WHERE account_id=$1", [c.account.id]))[0].token_hash).not.toBe(token);
    expect(await loyalty.lookupQr("0".repeat(64), db)).toBeUndefined();
    expect(await loyalty.lookupQr("not-a-token", db)).toBeUndefined();
  });
  it("redeems once, deducts exactly once, and prevents replay", async () => {
    await reward("free-drink", 100);
    const c = await customer(); await fund(c.account.id, 250);
    const { token } = await loyalty.issueQr(c.account.id, db);
    const key = `redeem-${randomUUID()}`;
    expect(await loyalty.redeemReward({ token, rewardId: "free-drink", key, actor: "staff" }, db)).toMatchObject({ duplicate: false, balance: 150, reward: "Free drink" });
    expect(await loyalty.redeemReward({ token, rewardId: "free-drink", key, actor: "staff" }, db)).toMatchObject({ duplicate: true, balance: 150 });
    await expect(loyalty.redeemReward({ token, rewardId: "free-drink", key: `other-${randomUUID()}`, actor: "staff" }, db)).rejects.toMatchObject({ code: "QR_USED" });
    expect(await loyalty.lookupQr(token, db)).toBeUndefined();
    expect((await loyalty.accountForUser(c.id, db))!.balance).toBe(150);
  });
  it("rejects insufficient balance, expired, superseded, unavailable, inactive and suspended cases without changing balances", async () => {
    await reward("free-drink", 100); await reward("hidden", 10, false);
    const c = await customer(); await fund(c.account.id, 50);
    const balance = async () => (await loyalty.accountForUser(c.id, db))!.balance;
    const fresh = async () => (await loyalty.issueQr(c.account.id, db)).token;
    const go = (token: string, rewardId = "free-drink") => loyalty.redeemReward({ token, rewardId, key: `k-${randomUUID()}`, actor: "staff" }, db);
    await expect(go(await fresh())).rejects.toMatchObject({ code: "INSUFFICIENT_POINTS" });
    await fund(c.account.id, 100);
    await expect(go(await fresh(), "hidden")).rejects.toMatchObject({ code: "REWARD_UNAVAILABLE" });
    await expect(go(await fresh(), "nope")).rejects.toMatchObject({ code: "REWARD_UNAVAILABLE" });
    const old = await fresh(); const newer = await fresh();
    await expect(go(old)).rejects.toMatchObject({ code: "QR_EXPIRED" });
    expect(await loyalty.lookupQr(newer, db)).toBeDefined();
    const expired = await fresh();
    await q("UPDATE loyalty_qr_tokens SET expires_at = now() - interval '1 second' WHERE account_id=$1", [c.account.id]);
    await expect(go(expired)).rejects.toMatchObject({ code: "QR_EXPIRED" });
    await expect(go("f".repeat(64))).rejects.toMatchObject({ code: "QR_INVALID" });
    await configure(false, 2);
    await expect(go(await fresh())).rejects.toMatchObject({ code: "PROGRAM_INACTIVE" });
    await configure(true, 2);
    await q("UPDATE loyalty_accounts SET status='suspended' WHERE id=$1", [c.account.id]);
    await expect(go(await fresh())).rejects.toMatchObject({ code: "ACCOUNT_SUSPENDED" });
    expect(await balance()).toBe(150);
  });
  it("keeps customers isolated: a token only ever resolves its own account", async () => {
    const a = await customer("Alice"); const b = await customer("Bruno"); await fund(a.account.id, 30); await fund(b.account.id, 90);
    const ta = (await loyalty.issueQr(a.account.id, db)).token;
    expect(await loyalty.lookupQr(ta, db)).toMatchObject({ firstName: "Alice", balance: 30 });
    expect((await loyalty.accountHistory(a.account.id, 50, db)).every(row => row.points === 30)).toBe(true);
    expect((await loyalty.accountHistory(b.account.id, 50, db)).every(row => row.points === 90)).toBe(true);
  });
});

describe("manual adjustments and audit", () => {
  it("requires a reason, never allows a negative balance, and records an immutable history", async () => {
    const c = await customer();
    await expect(loyalty.adjustPoints({ accountId: c.account.id, points: 10, reason: " ", key: `a-${randomUUID()}`, actor: "admin" }, db)).rejects.toMatchObject({ code: "FAILED" });
    await expect(loyalty.adjustPoints({ accountId: c.account.id, points: -5, reason: "correction", key: `a-${randomUUID()}`, actor: "admin" }, db)).rejects.toMatchObject({ code: "INSUFFICIENT_POINTS" });
    const key = `adj-${randomUUID()}`;
    await loyalty.adjustPoints({ accountId: c.account.id, points: 25, reason: "Goodwill", key, actor: "admin-1" }, db);
    expect(await loyalty.adjustPoints({ accountId: c.account.id, points: 25, reason: "Goodwill", key, actor: "admin-1" }, db)).toMatchObject({ duplicate: true, balance: 25 });
    await expect(loyalty.adjustPoints({ accountId: c.account.id, points: 26, reason: "Goodwill", key, actor: "admin-1" }, db)).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    const [row] = await loyalty.accountHistory(c.account.id, 5, db);
    expect(row).toMatchObject({ kind: "adjust", points: 25, balance_after: 25, reason: "Goodwill", actor: "admin-1" });
  });
});
