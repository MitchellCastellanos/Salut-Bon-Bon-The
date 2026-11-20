import { beforeEach, describe, expect, it, vi } from "vitest";

// Every administration server action must refuse anyone who is not ADMIN before it reads or writes the database.
const state = { role: undefined as "STAFF" | "ADMIN" | undefined };
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); }, notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }), headers: async () => new Headers() }));
vi.mock("../src/staff", () => ({ staffRole: async () => state.role, staffActor: async () => "actor-1" }));
vi.mock("../src/db", () => ({ database: async () => { throw new Error("DATABASE_TOUCHED"); } }));

const form = (fields: Record<string, string> = {}) => { const f = new FormData(); for (const [k, v] of Object.entries(fields)) f.set(k, v); return f; };
type Actions = Record<string, (...args: never[]) => Promise<unknown>>;
let modules: Record<string, Actions>;

beforeEach(async () => {
  process.env.DATABASE_URL = "postgres://invalid.example/none";
  modules = {
    menu: await import("../app/[lang]/admin/menu/actions") as unknown as Actions,
    store: await import("../app/[lang]/admin/store-actions") as unknown as Actions,
    hours: await import("../app/[lang]/admin/hours/actions") as unknown as Actions,
    business: await import("../app/[lang]/admin/business/actions") as unknown as Actions,
    website: await import("../app/[lang]/admin/website/actions") as unknown as Actions,
    team: await import("../app/[lang]/admin/team/actions") as unknown as Actions,
    customers: await import("../app/[lang]/admin/customers/actions") as unknown as Actions,
    orders: await import("../app/[lang]/admin/orders/[number]/actions") as unknown as Actions,
    demo: await import("../app/[lang]/admin/demo/actions") as unknown as Actions,
  };
});

describe("administration actions are ADMIN only", () => {
  for (const role of [undefined, "STAFF"] as const) {
    it(`${role ?? "a visitor or customer"} is refused by every admin action`, async () => {
      state.role = role;
      const call = (name: string, fn: string, ...args: unknown[]) => (modules[name][fn] as (...a: unknown[]) => Promise<unknown>)(...args);
      let count = 0;
      for (const [name, actions] of Object.entries(modules)) {
        for (const fn of Object.keys(actions)) {
          count++;
          await expect(call(name, fn, "en", form({ id: "x", order: "1", enabled: "0" })), `${name}.${fn}`).rejects.toThrow(/Forbidden/);
        }
      }
      expect(count).toBeGreaterThanOrEqual(20);
    });
  }
  it("ADMIN passes the gate and reaches the database", async () => {
    state.role = "ADMIN";
    await expect((modules.menu.toggleAvailability as (...a: unknown[]) => Promise<unknown>)("en", form({ id: "taro", available: "1" }))).rejects.toThrow(/REDIRECT:\/en\/admin\/menu\?error=FAILED/);
    await expect((modules.store.setOrdering as (...a: unknown[]) => Promise<unknown>)("en", form({ enabled: "0" }))).rejects.toThrow(/DATABASE_TOUCHED/);
  });
});
