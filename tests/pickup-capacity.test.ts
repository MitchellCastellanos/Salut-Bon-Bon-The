import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { upcomingPickup, salesTax, type PickupPolicy } from "../src/pickup-policy";

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite("pickup capacity under concurrency on real PostgreSQL", () => {
  const admin = new pg.Pool({ connectionString: url, max: 4 });
  const policy: PickupPolicy = {
    leadMinutes: 15, slotCapacity: 2, slotMinutes: 15, advanceDays: 3, taxRates: [5000, 9975],
    hours: Object.fromEntries(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => [d, [["00:00", "24:00"]]])),
  };
  let placeOrder: typeof import("../src/orders").placeOrder;
  let checkoutSchema: typeof import("../src/domain").checkoutSchema;
  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ placeOrder } = await import("../src/orders"));
    ({ checkoutSchema } = await import("../src/domain"));
    await admin.query("UPDATE catalog_products SET available = true WHERE id = '201'");
    await admin.query(`INSERT INTO catalog_variants (product_id, id, fr, en, price_cents, approved, available) VALUES ('201','regular','Régulier','Regular',650,true,true)
      ON CONFLICT (product_id, id) DO UPDATE SET price_cents = 650, approved = true, available = true`);
    await admin.query(`INSERT INTO catalog_store_settings (key, value) VALUES ('pickup_policy', $1::jsonb), ('pickup_checkout_enabled', 'true'::jsonb)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [JSON.stringify(policy)]);
  });
  afterAll(async () => {
    await admin.query("DELETE FROM catalog_store_settings WHERE key IN ('pickup_policy','pickup_checkout_enabled')");
    await admin.query("UPDATE catalog_products SET available = false WHERE id = '201'");
    await admin.query("DELETE FROM catalog_variants WHERE product_id = '201'");
    await admin.query("DELETE FROM order_events WHERE order_number IN (SELECT number FROM orders WHERE customer LIKE 'CAPACITY-%')");
    await admin.query("DELETE FROM orders WHERE customer LIKE 'CAPACITY-%'");
    await admin.end();
  });

  const total = 650 + salesTax(650, policy.taxRates);
  const order = (pickup: string, request = randomUUID()) => checkoutSchema.parse({
    request, lang: "en", name: `CAPACITY-${request.slice(0, 6)}`, notes: "", pickup, method: "pickup", expectedTotal: total,
    lines: [{ product: "201", size: "regular", sugar: "50", ice: "50", topping: "none", quantity: 1 }],
  });
  const outcome = (p: Promise<unknown>) => p.then(() => "ok", (e: Error) => e.message);

  it("accepts exactly slotCapacity orders when 12 arrive at once for one slot", async () => {
    const slot = upcomingPickup(policy)[10];
    const results = await Promise.all(Array.from({ length: 12 }, () => outcome(placeOrder(order(slot)))));
    expect(results.filter(r => r === "ok")).toHaveLength(2);
    expect(results.filter(r => r === "SLOT")).toHaveLength(10);
    const { rows: [row] } = await admin.query("SELECT count(*)::int AS n FROM orders WHERE pickup_at = $1 AND customer LIKE 'CAPACITY-%'", [slot]);
    expect(row.n).toBe(2);
  });

  it("treats a duplicated request id as one order even when submitted in parallel", async () => {
    const slot = upcomingPickup(policy)[20];
    const request = randomUUID();
    const results = await Promise.all(Array.from({ length: 6 }, () => placeOrder(order(slot, request)).then(r => r.number.toString())));
    expect(new Set(results).size).toBe(1);
    const { rows: [row] } = await admin.query("SELECT count(*)::int AS n FROM orders WHERE request_id = $1", [request]);
    expect(row.n).toBe(1);
  });

  it("refuses slots outside the schedule even when a client forges one", async () => {
    const closed = { ...policy, hours: { Mon: [["09:00", "10:00"]] } };
    await admin.query("UPDATE catalog_store_settings SET value = $1::jsonb WHERE key = 'pickup_policy'", [JSON.stringify(closed)]);
    const forged = new Date(Math.ceil((Date.now() + 3600_000) / 900_000) * 900_000 + 15 * 86_400_000).toISOString();
    expect(await outcome(placeOrder(order(forged)))).toBe("SLOT");
    await admin.query("UPDATE catalog_store_settings SET value = $1::jsonb WHERE key = 'pickup_policy'", [JSON.stringify(policy)]);
  });
});
