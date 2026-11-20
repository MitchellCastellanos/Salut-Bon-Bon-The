import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { checkoutSchema, pickupSlots, quote, type Line } from "../src/domain";
import { listOrders, placeOrder, recordPayment, trackOrder, updateOrder } from "../src/orders";

const local = vi.hoisted(() => ({ current: undefined as PGlite | undefined }));
vi.mock("../src/db", async () => {
  local.current = new PGlite();
  await (await vi.importActual<typeof import("../src/db")>("../src/db")).applyLocalMigrations(local.current);
  return { database: async () => local.current };
});
afterAll(async () => local.current?.close());

const line: Line = { product: "mango", quantity: 2, size: "large", sugar: "50", ice: "0", topping: "popping" };
function checkout() {
  return checkoutSchema.parse({
    request: randomUUID(), lang: "en", name: "Test guest", notes: "Test only",
    pickup: pickupSlots()[0], method: "pickup", lines: [line],
  });
}
describe("order rules", () => {
  it("prices modifier surcharges in integer cents", () => {
    expect(quote([line])[0].subtotal).toBe(1750); // the demo menu now charges $1.00 per topping, like the official one
    expect(() => quote([{ ...line, topping: "pearls" }])).toThrow("MENU");
    expect(checkoutSchema.safeParse({ ...checkout(), lines: [{ ...line, quantity: 11 }] }).success).toBe(false);
  });
  it("preserves a single order during concurrent retries and rejects changed details", async () => {
    const input = checkout();
    const [first, second] = await Promise.all([placeOrder(input), placeOrder(input)]);
    expect(first).toEqual(second);
    expect(await listOrders()).toHaveLength(1);
    await expect(placeOrder({ ...input, notes: "changed" })).rejects.toThrow("CONFLICT");
    expect(await trackOrder("no")).toBeUndefined();
    expect(await trackOrder(first.tracking_token)).toEqual({
      number: first.number, status: "RECEIVED", pickup_at: new Date(input.pickup)
    });
  });
  it("enforces state order, records payment once, and updates private tracking", async () => {
    const order = await placeOrder(checkout());
    const id = order.number.toString();
    expect(await updateOrder(id, "RECEIVED", "READY")).toBe(false);
    expect(await recordPayment(id)).toBe(false);
    expect(await updateOrder(id, "RECEIVED", "CONFIRMED")).toBe(true);
    expect(await updateOrder(id, "RECEIVED", "CONFIRMED")).toBe(false);
    expect(await updateOrder(id, "CONFIRMED", "PREPARING")).toBe(true);
    expect(await updateOrder(id, "PREPARING", "READY")).toBe(true);
    expect(await updateOrder(id, "READY", "COMPLETED")).toBe(false);
    expect(await recordPayment(id)).toBe(true);
    expect(await recordPayment(id)).toBe(false);
    expect(await updateOrder(id, "READY", "COMPLETED")).toBe(true);
    expect((await trackOrder(order.tracking_token))?.status).toBe("COMPLETED");
  });
  it("rejects stale pickup and keeps simulated payment separate", async () => {
    await expect(placeOrder({ ...checkout(), pickup: new Date(0).toISOString() })).rejects.toThrow("SLOT");
    const receipt = await placeOrder({ ...checkout(), method: "demo" });
    expect((await listOrders()).find(order => order.number === receipt.number)?.payment).toBe("DEMO_PAID");
  });
});
