import { cp, mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { applyLocalMigrations } from "../src/db";

/** Migration 010 runs on a database that already holds balances from the abandoned points scheme. */
async function previous() {
  const dir = await mkdtemp(join(tmpdir(), "salut-mig-"));
  for (const file of (await readdir("db")).filter(f => /^\d{3}-.+\.sql$/.test(f) && f < "010")) await cp(join("db", file), join(dir, file));
  const db = new PGlite();
  await applyLocalMigrations(db, dir);
  await db.query(`INSERT INTO "user" ("id","name","email","role") VALUES ('u1','Test','mig1@example.invalid','CUSTOMER')`);
  const { rows: [account] } = await db.query<{ id: string }>("INSERT INTO loyalty_accounts (user_id, member_code, balance) VALUES ('u1','KMNPQRST',640) RETURNING id");
  return { db, account };
}

describe("migration 010 (points to stamp card)", () => {
  it("clears old point balances through the append-only ledger and swaps the reward", async () => {
    const { db, account } = await previous();
    await applyLocalMigrations(db);
    const { rows: [after] } = await db.query<{ balance: number }>("SELECT balance FROM loyalty_accounts WHERE id=$1", [account.id]);
    expect(after.balance).toBe(0);
    const { rows: [entry] } = await db.query<{ kind: string; points: number; actor: string }>("SELECT kind, points, actor FROM loyalty_transactions WHERE account_id=$1", [account.id]);
    expect(entry).toEqual({ kind: "adjust", points: -640, actor: "system:migration-010" });
    const { rows: rewards } = await db.query<{ id: string; points_cost: number; available: boolean; preview_visible: boolean }>("SELECT id, points_cost, available, preview_visible FROM loyalty_rewards ORDER BY id");
    expect(rewards).toEqual([{ id: "free-drink", points_cost: 9, available: true, preview_visible: true }, { id: "rabais-5", points_cost: 1000, available: false, preview_visible: false }]);
    expect((await db.query("SELECT 1 FROM loyalty_program WHERE id=1 AND NOT active")).rows).toHaveLength(1);   // still inactive until an ADMIN decides
    await db.close();
  });
  it("refuses to guess when real balances exist under a commercially authorized program", async () => {
    const { db } = await previous();
    await db.query("UPDATE loyalty_program SET commercial_authorized = true WHERE id=1");
    await expect(applyLocalMigrations(db)).rejects.toThrow(/convert balances manually/);
    await db.close();
  });
});
