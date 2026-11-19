import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { applyLocalMigrations } from "../src/db";
import * as loyalty from "../src/loyalty";
import { maxStampsPerOrder, rewardState, stampCard, stampsForItems, stampsForReward, stampsKeptAfterRefund } from "../src/rewards-math";

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
  q("UPDATE loyalty_program SET active=$1, accrual_enabled=$2, redemption_enabled=$3, earn_categories=NULL, min_order_cents=0 WHERE id=1",
    [opts.active ?? true, opts.accrual ?? true, opts.redemption ?? true]);
const offerReward = (available: boolean) => q("UPDATE loyalty_rewards SET available=$1 WHERE id='free-drink'", [available]);
/** An order of `drinks` identical drinks at $5.00 each (pre-tax), or an explicit pre-tax subtotal. */
async function order(link: { user?: string | null; card?: string | null }, drinks: number, status = "COMPLETED", taxed = true, subtotal = drinks * 500) {
  const items = [{ product: "p1", quantity: drinks, subtotal }];
  const [o] = await q(`INSERT INTO orders (request_id,request_fingerprint,tracking_token,locale,customer,notes,pickup_at,items,total,payment,status,customer_user_id,loyalty_account_id,tax_cents)
    VALUES (gen_random_uuid(),'f',$1,'fr','T','',now(),$2,$3,'PAID_AT_PICKUP',$4,$5,$6,$7) RETURNING number::text AS number`,
    [String(++n).padStart(64, "d"), JSON.stringify(items), subtotal + (taxed ? Math.round(subtotal * 0.14975) : 0), status, link.user ?? null, link.card ?? null, taxed ? Math.round(subtotal * 0.14975) : 0]);
  return o.number as string;
}
const balance = async (id: string) => ((await q("SELECT balance FROM loyalty_accounts WHERE id=$1", [id]))[0].balance as number);
const refund = (orderNumber: string, cents: number, key = `refund-${randomUUID()}`) => loyalty.reverseForRefund({ order: orderNumber, refundCents: cents, reason: "customer refund", key, actor: "admin" }, db);

describe("pure arithmetic", () => {
  it("counts one stamp per drink, sums quantities and caps a single order", () => {
    expect(stampsForItems([{ quantity: 1 }])).toBe(1);
    expect(stampsForItems([{ quantity: 2 }, { quantity: 3 }])).toBe(5);
    expect(stampsForItems([{ quantity: 14 }])).toBe(maxStampsPerOrder);
    expect(stampsForItems([{ quantity: 0 }, { quantity: -2 }, { quantity: 1.5 }, { quantity: "3" }, {}])).toBe(0);
    expect(stampsForItems([])).toBe(0);
  });
  it("derives the progress bar from the balance: 9 purchased, the 10th is free", () => {
    expect(stampsForReward).toBe(9);
    expect(stampCard(0)).toMatchObject({ filled: 0, required: 9, toGo: 9, share: 0, ready: false, freeDrinks: 0, carried: 0 });
    expect(stampCard(6)).toMatchObject({ filled: 6, toGo: 3, ready: false });
    expect(stampCard(6).share).toBeCloseTo(2 / 3);
    expect(stampCard(9)).toMatchObject({ filled: 9, toGo: 0, share: 1, ready: true, freeDrinks: 1, carried: 0 });
    expect(stampCard(12)).toMatchObject({ filled: 9, ready: true, freeDrinks: 1, carried: 3 });
    expect(stampCard(18)).toMatchObject({ freeDrinks: 2 });
    expect(stampCard(-4)).toMatchObject({ filled: 0, ready: false });
    expect(stampCard(2.5)).toMatchObject({ filled: 0 });
    expect(stampCard(5, 0)).toMatchObject({ required: 9 });
  });
  it("keeps floor(earned x remaining / eligible) stamps after a refund", () => {
    expect(stampsKeptAfterRefund(4, 2000, 0)).toBe(4);
    expect(stampsKeptAfterRefund(4, 2000, 500)).toBe(3);
    expect(stampsKeptAfterRefund(4, 2000, 2000)).toBe(0);
    expect(stampsKeptAfterRefund(3, 1499, 333)).toBe(2);
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
  it("seeds the free drink at 9 stamps and withdraws the points reward, with nothing operational", async () => {
    const pub = await loyalty.publicRewards(db);
    expect(pub).toMatchObject({ previewVisible: true, operational: false, accrualOperational: false, redemptionOperational: false, stampsRequired: 9, maxStampsPerOrder: 10 });
    expect(pub.featured).toMatchObject({ id: "free-drink", pointsCost: 9, discountCents: null, state: "coming_soon" });
    expect(pub.rewards.map(r => r.id)).toEqual(["free-drink"]);            // the old $5 reward is no longer listed
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

describe("earning stamps", () => {
  it("awards one stamp per drink on a completed order and records the pre-tax eligible base", async () => {
    await operate();
    const m = await member();
    const o = await order({ user: m.id }, 3);                  // 3 drinks; the total includes ~14.975 % tax
    expect(await loyalty.earnForOrder(o, db)).toEqual({ awarded: 3 });
    expect(await balance(m.account.id)).toBe(3);
    expect((await q("SELECT eligible_cents FROM loyalty_transactions WHERE order_number=$1", [o]))[0].eligible_cents).toBe(1500);
  });
  it("counts quantities and caps a single order", async () => {
    const m = await member();
    expect(await loyalty.earnForOrder(await order({ user: m.id }, 14), db)).toEqual({ awarded: maxStampsPerOrder });
    expect(await balance(m.account.id)).toBe(maxStampsPerOrder);
  });
  it("is idempotent for duplicate completion events, even concurrent ones", async () => {
    const m = await member(); const o = await order({ user: m.id }, 4);
    const results = await Promise.all([loyalty.earnForOrder(o, db), loyalty.earnForOrder(o, db), loyalty.earnForOrder(o, db)]);
    expect(results.filter(r => r.awarded > 0)).toHaveLength(1);
    expect(await balance(m.account.id)).toBe(4);
  });
  it("gives nothing for cancelled or unfinished orders, or an order with no member or card", async () => {
    const m = await member();
    expect(await loyalty.earnForOrder(await order({ user: m.id }, 2, "CANCELLED"), db)).toEqual({ awarded: 0 });
    expect(await loyalty.earnForOrder(await order({ user: m.id }, 2, "READY"), db)).toEqual({ awarded: 0 });
    expect(await loyalty.earnForOrder(await order({}, 2), db)).toEqual({ awarded: 0 });
    expect(await balance(m.account.id)).toBe(0);
  });
  it("gives nothing while the program is inactive or earning is switched off", async () => {
    const m = await member(); const o = await order({ user: m.id }, 2);
    await operate({ active: false });
    expect(await loyalty.earnForOrder(o, db)).toEqual({ awarded: 0 });
    await operate({ accrual: false });
    expect(await loyalty.earnForOrder(o, db)).toEqual({ awarded: 0 });
    await expect(loyalty.awardInStore({ accountId: m.account.id, drinks: 1, key: `s-${randomUUID()}`, actor: "staff" }, db)).rejects.toMatchObject({ code: "ACCRUAL_DISABLED" });
    await operate({ active: false });
    await expect(loyalty.awardInStore({ accountId: m.account.id, drinks: 1, key: `s-${randomUUID()}`, actor: "staff" }, db)).rejects.toMatchObject({ code: "PROGRAM_INACTIVE" });
    await operate();
    expect(await loyalty.earnForOrder(o, db)).toEqual({ awarded: 2 });
  });
  it("honours the minimum order and the eligible categories", async () => {
    await q("INSERT INTO catalog_categories VALUES ('snacks','Collations','Snacks') ON CONFLICT DO NOTHING");
    await q("INSERT INTO catalog_products (id, category) VALUES ('p2','snacks') ON CONFLICT DO NOTHING");
    const m = await member();
    await q("UPDATE loyalty_program SET min_order_cents = 2000 WHERE id=1");
    expect(await loyalty.earnForOrder(await order({ user: m.id }, 3), db)).toEqual({ awarded: 0 });   // $15 < $20
    expect(await loyalty.earnForOrder(await order({ user: m.id }, 4), db)).toEqual({ awarded: 4 });   // $20
    await q("UPDATE loyalty_program SET min_order_cents = 0, earn_categories = ARRAY['milk-tea'] WHERE id=1");
    const [mixed] = await q(`INSERT INTO orders (request_id,request_fingerprint,tracking_token,locale,customer,notes,pickup_at,items,total,payment,status,customer_user_id,tax_cents)
      VALUES (gen_random_uuid(),'f',$1,'fr','T','',now(),$2,2000,'PAID_AT_PICKUP','COMPLETED',$3,0) RETURNING number::text AS number`,
      [String(++n).padStart(64, "e"), JSON.stringify([{ product: "p1", quantity: 2, subtotal: 1000 }, { product: "p2", quantity: 5, subtotal: 1000 }]), m.id]);
    expect(await loyalty.earnForOrder(mixed.number as string, db)).toEqual({ awarded: 2 });          // only the milk-tea drinks count
    await operate();
  });
  it("awards in-store purchases once per key and validates the drink count", async () => {
    const m = await member(); const key = `s-${randomUUID()}`;
    expect(await loyalty.awardInStore({ accountId: m.account.id, drinks: 2, key, actor: "staff" }, db)).toMatchObject({ awarded: 2, balance: 2 });
    expect(await loyalty.awardInStore({ accountId: m.account.id, drinks: 2, key, actor: "staff" }, db)).toMatchObject({ duplicate: true, balance: 2 });
    for (const drinks of [0, -1, 1.5, maxStampsPerOrder + 1, Number.NaN]) {
      await expect(loyalty.awardInStore({ accountId: m.account.id, drinks, key: `s-${randomUUID()}`, actor: "staff" }, db)).rejects.toMatchObject({ code: "FAILED" });
    }
    expect(await balance(m.account.id)).toBe(2);
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
    const o = await order({}, 3);
    await loyalty.linkOrderToCard(o, account.id, db);
    expect(await loyalty.earnForOrder(o, db)).toEqual({ awarded: 3 });
    const { token } = await loyalty.issueQr(account.id, db);
    const found = await loyalty.lookupQr(token, db);
    expect(found).toMatchObject({ guest: true, firstName: null, balance: 3, memberCode: account.member_code });
    expect(JSON.stringify(found)).not.toMatch(/@/);
  });
  it("never reassigns an order that already belongs to a member or another card", async () => {
    const m = await member(); const a = await loyalty.createGuestCard(db); const b = await loyalty.createGuestCard(db);
    const memberOrder = await order({ user: m.id }, 2);
    await loyalty.linkOrderToCard(memberOrder, a.account.id, db);
    expect((await q("SELECT loyalty_account_id FROM orders WHERE number=$1", [memberOrder]))[0].loyalty_account_id).toBeNull();
    const cardOrder = await order({}, 2);
    await loyalty.linkOrderToCard(cardOrder, a.account.id, db);
    await loyalty.linkOrderToCard(cardOrder, b.account.id, db);
    expect((await q("SELECT loyalty_account_id FROM orders WHERE number=$1", [cardOrder]))[0].loyalty_account_id).toBe(a.account.id);
  });
  it("links to a new account without duplicating stamps, and the secret stops working", async () => {
    const { secret, account } = await loyalty.createGuestCard(db);
    await loyalty.awardInStore({ accountId: account.id, drinks: 3, key: `s-${randomUUID()}`, actor: "staff" }, db);
    const user = randomUUID();
    await q(`INSERT INTO "user" ("id","name","email","role") VALUES ($1,'Nouveau','link1@example.invalid','CUSTOMER')`, [user]);
    const linked = await loyalty.linkGuestCard(secret, user, db);
    expect(linked.accountId).toBe(account.id);
    expect((await loyalty.accountForUser(user, db))?.balance).toBe(3);
    expect(await loyalty.guestAccount(secret, db)).toBeUndefined();
    await expect(loyalty.linkGuestCard(secret, user, db)).rejects.toMatchObject({ code: "GUEST_NOT_FOUND" });
    expect((await loyalty.accountForUser(user, db))?.balance).toBe(3);
  });
  it("moves stamps through the ledger into an existing account exactly once", async () => {
    const m = await member(); await loyalty.adjustPoints({ accountId: m.account.id, points: 5, reason: "seed balance", key: `f-${randomUUID()}`, actor: "admin" }, db);
    const { secret, account } = await loyalty.createGuestCard(db);
    await loyalty.awardInStore({ accountId: account.id, drinks: 2, key: `s-${randomUUID()}`, actor: "staff" }, db);
    const pending = await order({}, 4, "READY"); await loyalty.linkOrderToCard(pending, account.id, db);
    const before = (await balance(m.account.id)) + (await balance(account.id));
    await loyalty.linkGuestCard(secret, m.id, db);
    expect(await balance(m.account.id)).toBe(7);
    expect(await balance(account.id)).toBe(0);
    expect((await balance(m.account.id)) + (await balance(account.id))).toBe(before);
    expect((await q("SELECT status, merged_into FROM loyalty_accounts WHERE id=$1", [account.id]))[0]).toMatchObject({ status: "merged", merged_into: m.account.id });
    await q("UPDATE orders SET status='COMPLETED' WHERE number=$1", [pending]);
    expect(await loyalty.earnForOrder(pending, db)).toEqual({ awarded: 4 });       // a pending order follows the card to the member
    expect(await balance(m.account.id)).toBe(11);
    expect((await q("SELECT count(*)::int AS c FROM loyalty_transactions WHERE idempotency_key LIKE 'link-%' AND account_id IN ($1,$2)", [m.account.id, account.id]))[0].c).toBe(2);
  });
});

describe("QR identification and redemption of the free drink", () => {
  const funded = async (stamps: number) => { const m = await member(); await loyalty.adjustPoints({ accountId: m.account.id, points: stamps, reason: "test funding", key: `f-${randomUUID()}`, actor: "admin" }, db); return m; };
  const go = (token: string, key = `r-${randomUUID()}`) => loyalty.redeemReward({ token, rewardId: "free-drink", key, actor: "staff" }, db);
  it("redeems 9 stamps once, carries the rest over; a duplicate submit and a replay change nothing more", async () => {
    await operate(); await offerReward(true);
    const m = await funded(12); const { token } = await loyalty.issueQr(m.account.id, db); const key = `r-${randomUUID()}`;
    expect(await go(token, key)).toMatchObject({ duplicate: false, balance: 3, reward: "Free drink" });
    expect(await go(token, key)).toMatchObject({ duplicate: true, balance: 3 });
    await expect(go(token)).rejects.toMatchObject({ code: "QR_USED" });
    expect(await balance(m.account.id)).toBe(3);
    expect(stampCard(3)).toMatchObject({ filled: 3, toGo: 6 });
  });
  it("rejects expired codes, a card that is not full, inactive programs, disabled redemption and unoffered rewards without touching balances", async () => {
    const m = await funded(8);                                           // one short of the free drink
    await expect(go((await loyalty.issueQr(m.account.id, db)).token)).rejects.toMatchObject({ code: "INSUFFICIENT_POINTS" });
    await loyalty.adjustPoints({ accountId: m.account.id, points: 4, reason: "top up", key: `f-${randomUUID()}`, actor: "admin" }, db);
    const { token } = await loyalty.issueQr(m.account.id, db);
    await q("UPDATE loyalty_qr_tokens SET expires_at = now() - interval '1 second' WHERE account_id=$1", [m.account.id]);
    await expect(go(token)).rejects.toMatchObject({ code: "QR_EXPIRED" });
    expect(await loyalty.lookupQr(token, db)).toBeUndefined();
    const fresh = async () => (await loyalty.issueQr(m.account.id, db)).token;
    await operate({ active: false }); await expect(go(await fresh())).rejects.toMatchObject({ code: "PROGRAM_INACTIVE" });
    await operate({ redemption: false }); await expect(go(await fresh())).rejects.toMatchObject({ code: "REDEMPTION_DISABLED" });
    await operate(); await offerReward(false); await expect(go(await fresh())).rejects.toMatchObject({ code: "REWARD_UNAVAILABLE" });
    expect(await balance(m.account.id)).toBe(12);
    await offerReward(true);
  });
  it("a suspended account earns and redeems nothing", async () => {
    const m = await funded(20); await q("UPDATE loyalty_accounts SET status='suspended' WHERE id=$1", [m.account.id]);
    await expect(go((await loyalty.issueQr(m.account.id, db)).token)).rejects.toMatchObject({ code: "ACCOUNT_SUSPENDED" });
    expect(await loyalty.earnForOrder(await order({ user: m.id }, 2), db)).toEqual({ awarded: 0 });
  });
});

describe("refund reversal", () => {
  it("reverses proportionally for a partial refund and fully for a complete refund, cumulatively", async () => {
    await operate();
    const m = await member(); const o = await order({ user: m.id }, 4);   // $20.00 pre-tax
    await loyalty.earnForOrder(o, db);                                    // 4 stamps
    expect(await refund(o, 500)).toMatchObject({ reversed: 1, shortfall: 0, balance: 3 });
    expect(await refund(o, 500)).toMatchObject({ reversed: 1, balance: 2 });
    expect(await refund(o, 1000)).toMatchObject({ reversed: 2, balance: 0 });
    await expect(refund(o, 1)).rejects.toMatchObject({ code: "REFUND_EXCEEDS_PURCHASE" });
    expect((await q("SELECT sum(points)::int AS s FROM loyalty_transactions WHERE order_number=$1", [o]))[0].s).toBe(0);
  });
  it("a full refund in one step removes every stamp even with awkward rounding", async () => {
    const m = await member(); const o = await order({ user: m.id }, 3, "COMPLETED", true, 1499);
    await loyalty.earnForOrder(o, db);                                    // 3 stamps
    expect(await refund(o, 1499)).toMatchObject({ reversed: 3, balance: 0 });
  });
  it("is idempotent per refund key and rejects a key reused with other values", async () => {
    const m = await member(); const o = await order({ user: m.id }, 4); await loyalty.earnForOrder(o, db);
    const key = `refund-${randomUUID()}`;
    expect(await refund(o, 1000, key)).toMatchObject({ duplicate: false, reversed: 2 });
    expect(await refund(o, 1000, key)).toMatchObject({ duplicate: true, reversed: 2 });
    await expect(refund(o, 300, key)).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    expect(await balance(m.account.id)).toBe(2);
  });
  it("never makes the balance negative: stamps already spent on a free drink are recorded as a shortfall", async () => {
    const m = await member(); const o = await order({ user: m.id }, 4); await loyalty.earnForOrder(o, db);   // 4
    await offerReward(true);
    await loyalty.adjustPoints({ accountId: m.account.id, points: 5, reason: "bonus", key: `f-${randomUUID()}`, actor: "admin" }, db);   // 9
    await loyalty.redeemReward({ token: (await loyalty.issueQr(m.account.id, db)).token, rewardId: "free-drink", key: `r-${randomUUID()}`, actor: "staff" }, db);  // balance 0
    expect(await refund(o, 2000)).toMatchObject({ reversed: 0, shortfall: 4, balance: 0 });
    expect(await balance(m.account.id)).toBe(0);
  });
  it("rejects refunds for orders that earned nothing (cancelled, guest-less, in-store) and invalid input", async () => {
    await expect(refund(await order({}, 2), 500)).rejects.toMatchObject({ code: "NO_EARN_FOR_ORDER" });
    await expect(loyalty.reverseForRefund({ order: "abc", refundCents: 5, reason: "x y z", key: "k".repeat(10), actor: "a" }, db)).rejects.toMatchObject({ code: "FAILED" });
    const m = await member(); const o = await order({ user: m.id }, 2); await loyalty.earnForOrder(o, db);
    await expect(refund(o, 0)).rejects.toMatchObject({ code: "FAILED" });
  });
  it("refund history is append-only", async () => {
    await expect(q("UPDATE loyalty_refund_events SET shortfall = 0")).rejects.toThrow(/HISTORY_IS_APPEND_ONLY/);
    await expect(q("DELETE FROM loyalty_refund_events")).rejects.toThrow(/HISTORY_IS_APPEND_ONLY/);
  });
});

describe("ADMIN configuration", () => {
  const base = { active: false, minOrderCents: 0, categories: [] as string[], previewVisible: true, accrualEnabled: true, redemptionEnabled: true, commercialAuthorized: false };
  it("persists changes with an audit entry carrying the actor", async () => {
    await loyalty.saveProgramConfig({ ...base, minOrderCents: 500, categories: ["milk-tea"], previewVisible: false }, "admin-1", { production: false }, db);
    expect(await loyalty.loyaltyProgram(db)).toMatchObject({ minOrderCents: 500, earnCategories: ["milk-tea"], previewVisible: false });
    const audit = await q("SELECT details FROM catalog_audit_history WHERE action='loyalty.program' ORDER BY id DESC LIMIT 1");
    expect(audit[0].details).toMatchObject({ actor: "admin-1", min_order_cents: 500, preview_visible: false });
    await loyalty.saveProgramConfig(base, "admin-1", { production: false }, db);
  });
  it("production activation needs the owner's recorded authorization", async () => {
    await expect(loyalty.saveProgramConfig({ ...base, active: true }, "a", { production: true }, db)).rejects.toMatchObject({ code: "NOT_AUTHORIZED" });
    await loyalty.saveProgramConfig({ ...base, active: true, commercialAuthorized: true }, "owner-admin", { production: true }, db);
    expect((await q("SELECT commercial_authorized_by AS by, commercial_authorized_at IS NOT NULL AS at FROM loyalty_program"))[0]).toEqual({ by: "owner-admin", at: true });
    await loyalty.saveProgramConfig(base, "owner-admin", { production: true }, db);
    expect((await q("SELECT commercial_authorized_by AS by FROM loyalty_program"))[0]).toEqual({ by: null });
  });
  it("rejects invalid values", async () => {
    await expect(loyalty.saveProgramConfig({ ...base, minOrderCents: -1 }, "a", { production: false }, db)).rejects.toMatchObject({ code: "FAILED" });
  });
});
