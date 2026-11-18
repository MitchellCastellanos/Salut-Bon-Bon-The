import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { applyLocalMigrations } from "../src/db";
import * as loyalty from "../src/loyalty";
import { parseDollars, pointsFor, pointsKeptAfterRefund, progress, returnPercent, rewardState, spendToEarn, valueCents } from "../src/rewards-math";

const db = new PGlite();
const q = async (sql: string, args: unknown[] = []) => (await db.query<Record<string, unknown>>(sql, args)).rows;
beforeAll(async () => {
  await applyLocalMigrations(db);
  await q("INSERT INTO catalog_categories VALUES ('milk-tea','Thé au lait','Milk tea')");
  await q("INSERT INTO catalog_products (id, category) VALUES ('p1','milk-tea')");
});
afterAll(async () => db.close());

let n = 0;
async function member(name = "Léa Gagnon") {
  n++;
  const id = randomUUID();
  await q(`INSERT INTO "user" ("id","name","email","role") VALUES ($1,$2,$3,'CUSTOMER')`, [id, name, `m${n}@example.invalid`]);
  return { id, account: await loyalty.enroll(id, db) };
}
const operate = (opts: Partial<{ active: boolean; accrual: boolean; redemption: boolean }> = {}) =>
  q("UPDATE loyalty_program SET active=$1, accrual_enabled=$2, redemption_enabled=$3, points_per_dollar=10, earn_categories=NULL, min_order_cents=0 WHERE id=1",
    [opts.active ?? true, opts.accrual ?? true, opts.redemption ?? true]);
const offerReward = (available: boolean) => q("UPDATE loyalty_rewards SET available=$1 WHERE id='rabais-5'", [available]);
async function order(link: { user?: string | null; card?: string | null }, subtotal: number, status = "COMPLETED", taxed = true) {
  const items = [{ product: "p1", subtotal }];
  const [o] = await q(`INSERT INTO orders (request_id,request_fingerprint,tracking_token,locale,customer,notes,pickup_at,items,total,payment,status,customer_user_id,loyalty_account_id,tax_cents)
    VALUES (gen_random_uuid(),'f',$1,'fr','T','',now(),$2,$3,'PAID_AT_PICKUP',$4,$5,$6,$7) RETURNING number::text AS number`,
    [String(++n).padStart(64, "d"), JSON.stringify(items), subtotal + (taxed ? Math.round(subtotal * 0.14975) : 0), status, link.user ?? null, link.card ?? null, taxed ? Math.round(subtotal * 0.14975) : 0]);
  return o.number as string;
}
const balance = async (id: string) => ((await q("SELECT balance FROM loyalty_accounts WHERE id=$1", [id]))[0].balance as number);
const refund = (orderNumber: string, cents: number, key = `refund-${randomUUID()}`) => loyalty.reverseForRefund({ order: orderNumber, refundCents: cents, reason: "customer refund", key, actor: "admin" }, db);

describe("pure arithmetic (integer cents, explicit rounding)", () => {
  it("earns 10 points per $1, i.e. 5 % of eligible spend, rounded down once per order", () => {
    expect(pointsFor(1000, 10)).toBe(100);
    expect(pointsFor(2000, 10)).toBe(200);
    expect(pointsFor(1099, 10)).toBe(109);   // 109.9 -> 109 (never rounded up)
    expect(pointsFor(9, 10)).toBe(0);        // 0.9 point
    expect(pointsFor(10, 10)).toBe(1);
    expect(pointsFor(0, 10)).toBe(0);
    expect(pointsFor(-500, 10)).toBe(0);
    expect(pointsFor(1.5, 10)).toBe(0);      // non-integer cents are never accepted
    expect(pointsFor(1000, 0)).toBe(0);
  });
  it("derives the 5 % from the real rate and reward instead of hard-coding it", () => {
    expect(returnPercent(10, { pointsCost: 1000, discountCents: 500 })).toBe(5);
    expect(returnPercent(20, { pointsCost: 1000, discountCents: 500 })).toBe(10);
    expect(returnPercent(null, { pointsCost: 1000, discountCents: 500 })).toBeNull();
    expect(valueCents(1000, { pointsCost: 1000, discountCents: 500 })).toBe(500);
    expect(valueCents(999, { pointsCost: 1000, discountCents: 500 })).toBe(499);
  });
  it("computes calculator progress and the spend still needed", () => {
    expect(progress(250, 1000)).toEqual({ share: 0.25, missing: 750 });
    expect(progress(5000, 1000)).toEqual({ share: 1, missing: 0 });
    expect(spendToEarn(750, 10)).toBe(7500);
    expect(spendToEarn(0, 10)).toBe(0);
    expect(parseDollars("12,50")).toBe(1250);
    expect(parseDollars("7")).toBe(700);
    expect(parseDollars("abc")).toBeUndefined();
    expect(parseDollars("-3")).toBeUndefined();
    expect(parseDollars("99999")).toBeUndefined();
  });
  it("keeps floor(earned x remaining / eligible) points after a refund", () => {
    expect(pointsKeptAfterRefund(100, 1000, 0)).toBe(100);
    expect(pointsKeptAfterRefund(100, 1000, 400)).toBe(60);
    expect(pointsKeptAfterRefund(100, 1000, 1000)).toBe(0);
    expect(pointsKeptAfterRefund(109, 1099, 333)).toBe(75);
  });
  it("never shows an inactive or unoffered reward as redeemable", () => {
    expect(rewardState({ available: true }, { active: true, redemptionOperational: true })).toBe("available");
    expect(rewardState({ available: true }, { active: false, redemptionOperational: false })).toBe("coming_soon");
    expect(rewardState({ available: false }, { active: false, redemptionOperational: false })).toBe("coming_soon");
    expect(rewardState({ available: false }, { active: true, redemptionOperational: true })).toBe("unavailable");
    expect(rewardState({ available: true }, { active: true, redemptionOperational: false })).toBe("coming_soon");
  });
});

describe("preview configuration and public data", () => {
  it("seeds 10 points per $1 and a $5 / 1,000-point reward, with nothing operational", async () => {
    const pub = await loyalty.publicRewards(db);
    expect(pub).toMatchObject({ previewVisible: true, operational: false, accrualOperational: false, redemptionOperational: false, pointsPerDollar: 10, percent: 5 });
    expect(pub.featured).toMatchObject({ id: "rabais-5", pointsCost: 1000, discountCents: 500, state: "coming_soon" });
    expect(await loyalty.availableRewards(db)).toEqual([]);
  });
  it("separates the five lifecycle states", async () => {
    expect(loyalty.programStages(await loyalty.loyaltyProgram(db))).toEqual({ configured: true, previewVisible: true, accrualOperational: false, redemptionOperational: false, commercialAuthorized: false });
  });
  it("lists a reward as available only when the program, redemption and the reward are all switched on", async () => {
    await offerReward(true); await operate({ active: false });
    expect((await loyalty.publicRewards(db)).featured?.state).toBe("coming_soon");   // offered, program inactive: not redeemable
    await operate({ active: true, redemption: false });
    expect((await loyalty.publicRewards(db)).featured?.state).toBe("coming_soon");
    await operate({ active: true });
    expect((await loyalty.publicRewards(db)).featured?.state).toBe("available");
    await offerReward(false);
    expect((await loyalty.publicRewards(db)).featured?.state).toBe("unavailable");   // inactive reward, active program
    await operate({ active: false });
  });
  it("carries no private data: no accounts, members, balances, emails or orders", async () => {
    const m = await member("Marie Tremblay"); await q("UPDATE loyalty_accounts SET balance = 4321 WHERE id=$1", [m.account.id]);
    const json = JSON.stringify(await loyalty.publicRewards(db));
    expect(json).not.toMatch(/Tremblay|example\.invalid|4321|member|user_id|balance|account|email/i);
    expect(json).not.toContain(m.account.member_code);
  });
});

describe("earning at 5 %", () => {
  it("awards 10 points per eligible dollar on the pre-tax subtotal and never on tax", async () => {
    await operate();
    const m = await member();
    const o = await order({ user: m.id }, 1099);               // total includes ~14.975 % tax
    expect(await loyalty.earnForOrder(o, db)).toEqual({ awarded: 109 });
    expect(await balance(m.account.id)).toBe(109);
    expect((await q("SELECT eligible_cents FROM loyalty_transactions WHERE order_number=$1", [o]))[0].eligible_cents).toBe(1099);
  });
  it("is idempotent for duplicate completion events, even concurrent ones", async () => {
    const m = await member(); const o = await order({ user: m.id }, 2000);
    const results = await Promise.all([loyalty.earnForOrder(o, db), loyalty.earnForOrder(o, db), loyalty.earnForOrder(o, db)]);
    expect(results.filter(r => r.awarded > 0)).toHaveLength(1);
    expect(await balance(m.account.id)).toBe(200);
  });
  it("gives nothing for cancelled or unfinished orders, or an order with no member or card", async () => {
    const m = await member();
    expect(await loyalty.earnForOrder(await order({ user: m.id }, 1000, "CANCELLED"), db)).toEqual({ awarded: 0 });
    expect(await loyalty.earnForOrder(await order({ user: m.id }, 1000, "READY"), db)).toEqual({ awarded: 0 });
    expect(await loyalty.earnForOrder(await order({}, 1000), db)).toEqual({ awarded: 0 });
    expect(await balance(m.account.id)).toBe(0);
  });
  it("gives nothing while the program is inactive or earning is switched off, and for sub-point amounts", async () => {
    const m = await member(); const o = await order({ user: m.id }, 1000);
    await operate({ active: false });
    expect(await loyalty.earnForOrder(o, db)).toEqual({ awarded: 0 });
    await operate({ accrual: false });
    expect(await loyalty.earnForOrder(o, db)).toEqual({ awarded: 0 });
    await expect(loyalty.awardInStore({ accountId: m.account.id, cents: 1000, key: `s-${randomUUID()}`, actor: "staff" }, db)).rejects.toMatchObject({ code: "ACCRUAL_DISABLED" });
    await operate();
    expect(await loyalty.earnForOrder(await order({ user: m.id }, 9), db)).toEqual({ awarded: 0 });
    expect(await loyalty.earnForOrder(o, db)).toEqual({ awarded: 100 });
  });
  it("awards in-store purchases once per key", async () => {
    const m = await member(); const key = `s-${randomUUID()}`;
    expect(await loyalty.awardInStore({ accountId: m.account.id, cents: 1250, key, actor: "staff" }, db)).toMatchObject({ awarded: 125, balance: 125 });
    expect(await loyalty.awardInStore({ accountId: m.account.id, cents: 1250, key, actor: "staff" }, db)).toMatchObject({ duplicate: true, balance: 125 });
  });
});

describe("guest cards", () => {
  it("stores only a hash of the card secret and resolves only the exact secret", async () => {
    const { secret, account } = await loyalty.createGuestCard(db);
    expect(secret).toMatch(/^[0-9a-f]{64}$/);
    const stored = await q("SELECT guest_secret_hash, user_id FROM loyalty_accounts WHERE id=$1", [account.id]);
    expect(stored[0].user_id).toBeNull();
    expect(stored[0].guest_secret_hash).toBe(createHash("sha256").update(secret).digest("hex"));
    expect(JSON.stringify(await q("SELECT * FROM loyalty_accounts WHERE id=$1", [account.id]))).not.toContain(secret);
    expect((await loyalty.guestAccount(secret, db))?.id).toBe(account.id);
    expect(await loyalty.guestAccount(account.member_code, db)).toBeUndefined();      // the short member code is never a credential
    expect(await loyalty.guestAccount("0".repeat(64), db)).toBeUndefined();
    expect(await loyalty.guestAccount("not-hex", db)).toBeUndefined();
  });
  it("earns on online orders linked to the card and on in-store purchases, and identifies without a name or email", async () => {
    const { account } = await loyalty.createGuestCard(db);
    const o = await order({}, 1500);
    await loyalty.linkOrderToCard(o, account.id, db);
    expect(await loyalty.earnForOrder(o, db)).toEqual({ awarded: 150 });
    const { token } = await loyalty.issueQr(account.id, db);
    const found = await loyalty.lookupQr(token, db);
    expect(found).toMatchObject({ guest: true, firstName: null, balance: 150, memberCode: account.member_code });
    expect(JSON.stringify(found)).not.toMatch(/@/);
  });
  it("never reassigns an order that already belongs to a member or another card", async () => {
    const m = await member(); const a = await loyalty.createGuestCard(db); const b = await loyalty.createGuestCard(db);
    const memberOrder = await order({ user: m.id }, 1000);
    await loyalty.linkOrderToCard(memberOrder, a.account.id, db);
    expect((await q("SELECT loyalty_account_id FROM orders WHERE number=$1", [memberOrder]))[0].loyalty_account_id).toBeNull();
    const cardOrder = await order({}, 1000);
    await loyalty.linkOrderToCard(cardOrder, a.account.id, db);
    await loyalty.linkOrderToCard(cardOrder, b.account.id, db);
    expect((await q("SELECT loyalty_account_id FROM orders WHERE number=$1", [cardOrder]))[0].loyalty_account_id).toBe(a.account.id);
  });
  it("links to a new account without duplicating points, and the secret stops working", async () => {
    const { secret, account } = await loyalty.createGuestCard(db);
    await loyalty.awardInStore({ accountId: account.id, cents: 3000, key: `s-${randomUUID()}`, actor: "staff" }, db);
    const user = randomUUID();
    await q(`INSERT INTO "user" ("id","name","email","role") VALUES ($1,'Nouveau','link1@example.invalid','CUSTOMER')`, [user]);
    const linked = await loyalty.linkGuestCard(secret, user, db);
    expect(linked.accountId).toBe(account.id);
    expect((await loyalty.accountForUser(user, db))?.balance).toBe(300);
    expect(await loyalty.guestAccount(secret, db)).toBeUndefined();
    await expect(loyalty.linkGuestCard(secret, user, db)).rejects.toMatchObject({ code: "GUEST_NOT_FOUND" });
    expect((await loyalty.accountForUser(user, db))?.balance).toBe(300);
  });
  it("moves points through the ledger into an existing account exactly once", async () => {
    const m = await member(); await loyalty.adjustPoints({ accountId: m.account.id, points: 50, reason: "seed balance", key: `f-${randomUUID()}`, actor: "admin" }, db);
    const { secret, account } = await loyalty.createGuestCard(db);
    await loyalty.awardInStore({ accountId: account.id, cents: 2000, key: `s-${randomUUID()}`, actor: "staff" }, db);
    const pending = await order({}, 1000, "READY"); await loyalty.linkOrderToCard(pending, account.id, db);
    const before = (await balance(m.account.id)) + (await balance(account.id));
    await loyalty.linkGuestCard(secret, m.id, db);
    expect(await balance(m.account.id)).toBe(250);
    expect(await balance(account.id)).toBe(0);
    expect((await balance(m.account.id)) + (await balance(account.id))).toBe(before);
    expect((await q("SELECT status, merged_into FROM loyalty_accounts WHERE id=$1", [account.id]))[0]).toMatchObject({ status: "merged", merged_into: m.account.id });
    await q("UPDATE orders SET status='COMPLETED' WHERE number=$1", [pending]);
    expect(await loyalty.earnForOrder(pending, db)).toEqual({ awarded: 100 });       // a pending order follows the card to the member
    expect(await balance(m.account.id)).toBe(350);
    expect((await q("SELECT count(*)::int AS c FROM loyalty_transactions WHERE idempotency_key LIKE 'link-%' AND account_id IN ($1,$2)", [m.account.id, account.id]))[0].c).toBe(2);
  });
});

describe("QR identification and redemption of the $5 reward", () => {
  const funded = async (points: number) => { const m = await member(); await loyalty.adjustPoints({ accountId: m.account.id, points, reason: "test funding", key: `f-${randomUUID()}`, actor: "admin" }, db); return m; };
  const go = (token: string, key = `r-${randomUUID()}`) => loyalty.redeemReward({ token, rewardId: "rabais-5", key, actor: "staff" }, db);
  it("redeems 1,000 points once; a duplicate submit and a replay change nothing more", async () => {
    await operate(); await offerReward(true);
    const m = await funded(1500); const { token } = await loyalty.issueQr(m.account.id, db); const key = `r-${randomUUID()}`;
    expect(await go(token, key)).toMatchObject({ duplicate: false, balance: 500, reward: "$5 off" });
    expect(await go(token, key)).toMatchObject({ duplicate: true, balance: 500 });
    await expect(go(token)).rejects.toMatchObject({ code: "QR_USED" });
    expect(await balance(m.account.id)).toBe(500);
  });
  it("rejects expired codes, insufficient points, inactive programs, disabled redemption and unoffered rewards without touching balances", async () => {
    const m = await funded(900);
    await expect(go((await loyalty.issueQr(m.account.id, db)).token)).rejects.toMatchObject({ code: "INSUFFICIENT_POINTS" });
    await loyalty.adjustPoints({ accountId: m.account.id, points: 600, reason: "top up", key: `f-${randomUUID()}`, actor: "admin" }, db);
    const { token } = await loyalty.issueQr(m.account.id, db);
    await q("UPDATE loyalty_qr_tokens SET expires_at = now() - interval '1 second' WHERE account_id=$1", [m.account.id]);
    await expect(go(token)).rejects.toMatchObject({ code: "QR_EXPIRED" });
    expect(await loyalty.lookupQr(token, db)).toBeUndefined();
    const fresh = async () => (await loyalty.issueQr(m.account.id, db)).token;
    await operate({ active: false }); await expect(go(await fresh())).rejects.toMatchObject({ code: "PROGRAM_INACTIVE" });
    await operate({ redemption: false }); await expect(go(await fresh())).rejects.toMatchObject({ code: "REDEMPTION_DISABLED" });
    await operate(); await offerReward(false); await expect(go(await fresh())).rejects.toMatchObject({ code: "REWARD_UNAVAILABLE" });
    expect(await balance(m.account.id)).toBe(1500);
    await offerReward(true);
  });
  it("a suspended account earns and redeems nothing", async () => {
    const m = await funded(2000); await q("UPDATE loyalty_accounts SET status='suspended' WHERE id=$1", [m.account.id]);
    await expect(go((await loyalty.issueQr(m.account.id, db)).token)).rejects.toMatchObject({ code: "ACCOUNT_SUSPENDED" });
    expect(await loyalty.earnForOrder(await order({ user: m.id }, 1000), db)).toEqual({ awarded: 0 });
  });
});

describe("refund reversal", () => {
  it("reverses proportionally for a partial refund and fully for a complete refund, cumulatively", async () => {
    await operate();
    const m = await member(); const o = await order({ user: m.id }, 1000);
    await loyalty.earnForOrder(o, db);                                   // 100 points
    expect(await refund(o, 250)).toMatchObject({ reversed: 25, shortfall: 0, balance: 75 });
    expect(await refund(o, 250)).toMatchObject({ reversed: 25, balance: 50 });
    expect(await refund(o, 500)).toMatchObject({ reversed: 50, balance: 0 });
    await expect(refund(o, 1)).rejects.toMatchObject({ code: "REFUND_EXCEEDS_PURCHASE" });
    expect((await q("SELECT sum(points)::int AS s FROM loyalty_transactions WHERE order_number=$1", [o]))[0].s).toBe(0);
  });
  it("a full refund in one step removes every point even with awkward rounding", async () => {
    const m = await member(); const o = await order({ user: m.id }, 1099);
    await loyalty.earnForOrder(o, db);                                   // 109 points
    expect(await refund(o, 1099)).toMatchObject({ reversed: 109, balance: 0 });
  });
  it("is idempotent per refund key and rejects a key reused with other values", async () => {
    const m = await member(); const o = await order({ user: m.id }, 1000); await loyalty.earnForOrder(o, db);
    const key = `refund-${randomUUID()}`;
    expect(await refund(o, 500, key)).toMatchObject({ duplicate: false, reversed: 50 });
    expect(await refund(o, 500, key)).toMatchObject({ duplicate: true, reversed: 50 });
    await expect(refund(o, 300, key)).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    expect(await balance(m.account.id)).toBe(50);
  });
  it("never makes the balance negative: points already spent are recorded as a shortfall", async () => {
    const m = await member(); const o = await order({ user: m.id }, 1000); await loyalty.earnForOrder(o, db);   // 100
    await offerReward(true);
    await loyalty.adjustPoints({ accountId: m.account.id, points: 900, reason: "bonus", key: `f-${randomUUID()}`, actor: "admin" }, db);
    await loyalty.redeemReward({ token: (await loyalty.issueQr(m.account.id, db)).token, rewardId: "rabais-5", key: `r-${randomUUID()}`, actor: "staff" }, db);  // balance 0
    expect(await refund(o, 1000)).toMatchObject({ reversed: 0, shortfall: 100, balance: 0 });
    expect(await balance(m.account.id)).toBe(0);
  });
  it("rejects refunds for orders that earned nothing (cancelled, guest-less, in-store) and invalid input", async () => {
    await expect(refund(await order({}, 1000), 500)).rejects.toMatchObject({ code: "NO_EARN_FOR_ORDER" });
    await expect(loyalty.reverseForRefund({ order: "abc", refundCents: 5, reason: "x y z", key: "k".repeat(10), actor: "a" }, db)).rejects.toMatchObject({ code: "FAILED" });
    const m = await member(); const o = await order({ user: m.id }, 1000); await loyalty.earnForOrder(o, db);
    await expect(refund(o, 0)).rejects.toMatchObject({ code: "FAILED" });
  });
  it("refund history is append-only", async () => {
    await expect(q("UPDATE loyalty_refund_events SET shortfall = 0")).rejects.toThrow(/HISTORY_IS_APPEND_ONLY/);
    await expect(q("DELETE FROM loyalty_refund_events")).rejects.toThrow(/HISTORY_IS_APPEND_ONLY/);
  });
});

describe("ADMIN configuration", () => {
  const base = { active: false, rate: 10, minOrderCents: 0, categories: [] as string[], previewVisible: true, accrualEnabled: true, redemptionEnabled: true, commercialAuthorized: false };
  it("persists changes with an audit entry carrying the actor", async () => {
    await loyalty.saveProgramConfig({ ...base, rate: 20, minOrderCents: 500, categories: ["milk-tea"], previewVisible: false }, "admin-1", { production: false }, db);
    expect(await loyalty.loyaltyProgram(db)).toMatchObject({ pointsPerDollar: 20, minOrderCents: 500, earnCategories: ["milk-tea"], previewVisible: false });
    const audit = await q("SELECT details FROM catalog_audit_history WHERE action='loyalty.program' ORDER BY id DESC LIMIT 1");
    expect(audit[0].details).toMatchObject({ actor: "admin-1", points_per_dollar: 20, preview_visible: false });
    await loyalty.saveProgramConfig(base, "admin-1", { production: false }, db);
  });
  it("cannot activate without a rate, and production activation needs the owner's recorded authorization", async () => {
    await expect(loyalty.saveProgramConfig({ ...base, active: true, rate: null }, "a", { production: false }, db)).rejects.toMatchObject({ code: "PROGRAM_INACTIVE" });
    await expect(loyalty.saveProgramConfig({ ...base, active: true }, "a", { production: true }, db)).rejects.toMatchObject({ code: "NOT_AUTHORIZED" });
    await loyalty.saveProgramConfig({ ...base, active: true, commercialAuthorized: true }, "owner-admin", { production: true }, db);
    expect((await q("SELECT commercial_authorized_by AS by, commercial_authorized_at IS NOT NULL AS at FROM loyalty_program"))[0]).toEqual({ by: "owner-admin", at: true });
    await loyalty.saveProgramConfig(base, "owner-admin", { production: true }, db);
    expect((await q("SELECT commercial_authorized_by AS by FROM loyalty_program"))[0]).toEqual({ by: null });
  });
  it("rejects invalid values", async () => {
    await expect(loyalty.saveProgramConfig({ ...base, rate: 0 }, "a", { production: false }, db)).rejects.toMatchObject({ code: "FAILED" });
    await expect(loyalty.saveProgramConfig({ ...base, rate: 101 }, "a", { production: false }, db)).rejects.toMatchObject({ code: "FAILED" });
    await expect(loyalty.saveProgramConfig({ ...base, minOrderCents: -1 }, "a", { production: false }, db)).rejects.toMatchObject({ code: "FAILED" });
  });
});
