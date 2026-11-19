import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { applyLocalMigrations } from "../src/db";

const local = new PGlite();
vi.mock("../src/db", async importOriginal => ({ ...await importOriginal<typeof import("../src/db")>(), database: async () => local }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); }, notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
const state = { role: undefined as "STAFF" | "ADMIN" | undefined };
vi.mock("../src/staff", () => ({ staffRole: async () => state.role, staffActor: async () => "actor-1" }));

const team = await import("../src/team");
const actions = await import("../app/[lang]/admin/team/actions");
const form = (fields: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(fields)) f.set(k, v); return f; };
const roleOf = async (email: string) => (await local.query<{ role: string }>(`SELECT "role" FROM "user" WHERE "email" = $1`, [email])).rows[0]?.role;
const idOf = async (email: string) => (await local.query<{ id: string }>(`SELECT "id" FROM "user" WHERE "email" = $1`, [email])).rows[0].id;

beforeAll(async () => { process.env.DATABASE_URL = "postgres://unused.example/none"; await applyLocalMigrations(local); });

describe("team management", () => {
  it("creates verified staff with a hashed credential and refuses a duplicate email", async () => {
    const input = team.newMember.parse({ role: "STAFF", name: "Ana", email: " Ana@Example.invalid ", password: "AnaPassw0rd!xyz" });
    expect(await team.createMember(input)).toBe(true);
    expect(await team.createMember(input)).toBe(false);
    const { rows: [row] } = await local.query<{ password: string; emailVerified: boolean }>(`SELECT a."password", u."emailVerified" FROM "user" u JOIN "account" a ON a."userId" = u."id" WHERE u."email" = 'ana@example.invalid'`);
    expect(row.emailVerified).toBe(true);
    expect(row.password).not.toContain("AnaPassw0rd");
    expect(team.newMember.safeParse({ ...input, password: "short" }).success).toBe(false);
  });

  it("never removes or demotes the last administrator, or the actor themselves", async () => {
    await team.createMember(team.newMember.parse({ role: "ADMIN", name: "Boss", email: "boss@example.invalid", password: "BossPassw0rd!xyz" }));
    const boss = await idOf("boss@example.invalid");
    expect(await team.changeRole(boss, "STAFF", "someone-else")).toBe("LAST_ADMIN");
    expect(await team.revokeMember(boss, "someone-else")).toBe("LAST_ADMIN");
    expect(await team.revokeMember(boss, boss)).toBe("SELF");
    expect(await roleOf("boss@example.invalid")).toBe("ADMIN");
  });

  it("changes roles, resets passwords and revokes access while ending sessions", async () => {
    const ana = await idOf("ana@example.invalid");
    await local.query(`INSERT INTO "session" ("id", "expiresAt", "token", "updatedAt", "userId") VALUES ('s1', now() + interval '1 hour', 't1', now(), $1)`, [ana]);
    expect(await team.resetMemberPassword(ana, "NewPassw0rd!xyz1")).toBe(true);
    expect((await local.query(`SELECT 1 FROM "session" WHERE "userId" = $1`, [ana])).rows).toHaveLength(0);
    expect(await team.changeRole(ana, "ADMIN", "boss")).toBe("OK");
    expect(await team.changeRole(ana, "STAFF", "boss")).toBe("OK");
    expect(await team.revokeMember(ana, "boss")).toBe("OK");
    expect(await roleOf("ana@example.invalid")).toBe("CUSTOMER");
    expect(await team.resetMemberPassword(ana, "AnotherPassw0rd!x")).toBe(false);
  });
});

describe("team actions are ADMIN only", () => {
  for (const role of [undefined, "STAFF"] as const) {
    it(`rejects ${role ?? "an anonymous visitor"}`, async () => {
      state.role = role;
      await expect(actions.addMember("fr", form({ role: "ADMIN", name: "X", email: "x@example.invalid", password: "XPassw0rd!xyz12" }))).rejects.toThrow("Forbidden");
      await expect(actions.removeMember("fr", form({ id: "x" }))).rejects.toThrow("Forbidden");
      await expect(actions.setRole("fr", form({ id: "x", role: "ADMIN" }))).rejects.toThrow("Forbidden");
      await expect(actions.resetPassword("fr", form({ id: "x", password: "XPassw0rd!xyz12" }))).rejects.toThrow("Forbidden");
      expect(await roleOf("x@example.invalid")).toBeUndefined();
    });
  }
});
