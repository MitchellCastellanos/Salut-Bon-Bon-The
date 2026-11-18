import { createHash, randomBytes, randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as loyalty from "../src/loyalty";

// Needs a migrated real PostgreSQL (CI service container or a local server). Skipped otherwise.
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite("concurrent loyalty changes on real PostgreSQL", () => {
  const pool = new pg.Pool({ connectionString: url, max: 20 });
  const db = pool as unknown as Parameters<typeof loyalty.enroll>[1];
  beforeAll(async () => {
    await pool.query("UPDATE loyalty_program SET active = true, points_per_dollar = 1 WHERE id = 1");
    await pool.query(`INSERT INTO loyalty_rewards (id, name_fr, name_en, points_cost, available) VALUES ('conc-reward','Test','Test',30,true)
      ON CONFLICT (id) DO UPDATE SET points_cost = 30, available = true`);
  });
  afterAll(async () => {
    await pool.query("UPDATE loyalty_program SET active = false, points_per_dollar = NULL WHERE id = 1");
    await pool.query("UPDATE loyalty_rewards SET available = false WHERE id = 'conc-reward'");
    await pool.end();
  });
  async function funded(points: number) {
    const id = randomUUID();
    await pool.query(`INSERT INTO "user" ("id","name","email","role") VALUES ($1,'Conc Test',$2,'CUSTOMER')`, [id, `${id}@example.invalid`]);
    const account = await loyalty.enroll(id, db);
    await loyalty.adjustPoints({ accountId: account.id, points, reason: "concurrency test", key: `fund-${id}`, actor: "test" }, db);
    return account;
  }
  const outcome = (p: Promise<unknown>) => p.then(() => "ok", (e: { code?: string }) => e.code ?? "error");

  it("never overspends: 10 parallel redemptions of 30 points against 100 succeed exactly 3 times", async () => {
    const account = await funded(100);
    // issueQr() supersedes the previous token, so insert ten independent live tokens directly.
    const tokens = Array.from({ length: 10 }, () => randomBytes(32).toString("hex"));
    for (const token of tokens) {
      await pool.query("INSERT INTO loyalty_qr_tokens (account_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '5 minutes')",
        [account.id, createHash("sha256").update(token).digest("hex")]);
    }
    const results = await Promise.all(tokens.map(token => outcome(loyalty.redeemReward({ token, rewardId: "conc-reward", key: `r-${randomUUID()}`, actor: "staff" }, db))));
    expect(results.filter(r => r === "ok")).toHaveLength(3);
    expect(results.filter(r => r === "INSUFFICIENT_POINTS")).toHaveLength(7);
    expect((await loyalty.accountForUser(account.user_id, db))!.balance).toBe(10);
    const { rows: [sum] } = await pool.query("SELECT sum(points)::int AS s, count(*)::int AS c FROM loyalty_transactions WHERE account_id = $1", [account.id]);
    expect(sum).toEqual({ s: 10, c: 4 }); // +100 funding, 3 x -30
  });

  it("lets only one of 10 parallel scans of the same QR token redeem", async () => {
    const account = await funded(500);
    const { token } = await loyalty.issueQr(account.id, db);
    const results = await Promise.all(Array.from({ length: 10 }, () => outcome(loyalty.redeemReward({ token, rewardId: "conc-reward", key: `r-${randomUUID()}`, actor: "staff" }, db))));
    expect(results.filter(r => r === "ok")).toHaveLength(1);
    expect(results.filter(r => r === "QR_USED")).toHaveLength(9);
    expect((await loyalty.accountForUser(account.user_id, db))!.balance).toBe(470);
  });

  it("treats 10 parallel submissions with the same idempotency key as one redemption", async () => {
    const account = await funded(100);
    const { token } = await loyalty.issueQr(account.id, db);
    const key = `same-${randomUUID()}`;
    const all = await Promise.all(Array.from({ length: 10 }, () => loyalty.redeemReward({ token, rewardId: "conc-reward", key, actor: "staff" }, db)));
    expect(all.filter(r => !r.duplicate)).toHaveLength(1);
    expect(new Set(all.map(r => r.balance))).toEqual(new Set([70]));
  });

  it("awards a completed order's points once under parallel earn events", async () => {
    const account = await funded(0 + 1);
    const { rows: [order] } = await pool.query<{ number: string }>(`INSERT INTO orders (request_id,request_fingerprint,tracking_token,locale,customer,notes,pickup_at,items,total,payment,status,customer_user_id)
      VALUES (gen_random_uuid(),'f',encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex'),'en','T','',now(),'[{"product":"x","subtotal":1000}]',1000,'PAID_AT_PICKUP','COMPLETED',$1) RETURNING number::text AS number`, [account.user_id]);
    const awards = await Promise.all(Array.from({ length: 10 }, () => loyalty.earnForOrder(order.number, db)));
    expect(awards.filter(a => a.awarded > 0)).toHaveLength(1);
    expect((await loyalty.accountForUser(account.user_id, db))!.balance).toBe(1 + 10);
  });
});
