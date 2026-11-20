import { beforeEach, describe, expect, it, vi } from "vitest";

// Server actions are exercised with the staff session mocked, to prove the role gates run before any database access.
const state = { role: undefined as "STAFF" | "ADMIN" | undefined };
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); }, notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }), headers: async () => new Headers() }));
vi.mock("../src/staff", () => ({ staffRole: async () => state.role, staffActor: async () => "actor-1" }));
vi.mock("../src/db", () => ({ database: async () => { throw new Error("DATABASE_TOUCHED"); } }));
vi.mock("../src/customer", () => ({ customerSession: async () => ({ id: "customer-1", email: "c@example.invalid", name: "C" }) }));

const form = (fields: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(fields)) f.set(k, v); return f; };
let admin: typeof import("../app/[lang]/admin/rewards/actions");
let staff: typeof import("../app/[lang]/staff/rewards/actions");
beforeEach(async () => {
  process.env.DATABASE_URL = "postgres://invalid.example/none";
  admin = await import("../app/[lang]/admin/rewards/actions");
  staff = await import("../app/[lang]/staff/rewards/actions");
});

describe("role separation for Salut Rewards operations", () => {
  const program = form({ rate: "10", min: "" });
  const adjustForm = form({ account: "00000000-0000-4000-8000-000000000000", points: "5", reason: "test", key: "adjust-12345678", q: "" });
  for (const role of [undefined, "STAFF"] as const) {
    it(`${role ?? "a customer or visitor"} cannot change the program, rewards, adjustments or account status`, async () => {
      state.role = role;
      await expect(admin.saveProgram("fr", program)).rejects.toThrow("Forbidden");
      await expect(admin.saveReward("fr", form({}))).rejects.toThrow("Forbidden");
      await expect(admin.adjust("fr", adjustForm)).rejects.toThrow("Forbidden");
      await expect(admin.setAccountStatus("fr", form({ account: "x", status: "suspended", q: "" }))).rejects.toThrow("Forbidden");
    });
  }
  it("ADMIN passes the gate (and then fails only at the stubbed database)", async () => {
    state.role = "ADMIN";
    await expect(admin.saveProgram("fr", program)).rejects.toThrow(/DATABASE_TOUCHED|REDIRECT/);
  });
  it("a visitor or customer cannot redeem or award at the counter; no database call is made", async () => {
    state.role = undefined;
    const token = "a".repeat(64);
    await expect(staff.redeem("fr", form({ token, reward: "rabais-5", key: "redeem-12345678" }))).resolves.toBeUndefined();
    await expect(staff.award("fr", form({ token, key: "award-12345678", amount: "10.00" }))).resolves.toBeUndefined();
  });
  it("STAFF can reach the counter operations but never the ADMIN ones", async () => {
    state.role = "STAFF";
    await expect(staff.redeem("fr", form({ token: "bad", reward: "x", key: "k" }))).rejects.toThrow("REDIRECT:/fr/staff/rewards?error=QR_INVALID");
    await expect(admin.saveProgram("fr", program)).rejects.toThrow("Forbidden");
  });
});
