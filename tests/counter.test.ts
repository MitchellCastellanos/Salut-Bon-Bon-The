import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fiscalSchema } from "../src/business-core";

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite("counter (in-person) orders on real PostgreSQL", () => {
  const admin = new pg.Pool({ connectionString: url, max: 2 });
  let counter: typeof import("../src/counter");
  const line = { product: "201", size: "regular" as const, quantity: 2, optionIds: [] as string[] };
  const setFiscal = (value: unknown) => admin.query(`INSERT INTO catalog_store_settings (key, value) VALUES ('fiscal_settings', $1::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [JSON.stringify(value)]);
  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    counter = await import("../src/counter");
    await admin.query("UPDATE catalog_products SET available = true WHERE id = '201'");
    await admin.query(`INSERT INTO catalog_variants (product_id, id, fr, en, price_cents, approved, available) VALUES ('201','regular','Régulier','Regular',650,true,true)
      ON CONFLICT (product_id, id) DO UPDATE SET price_cents = 650, approved = true, available = true`);
    await admin.query("DELETE FROM catalog_store_settings WHERE key = 'pickup_checkout_enabled'"); // counter sales must not depend on the online switch
  });
  afterAll(async () => {
    await admin.query("DELETE FROM catalog_store_settings WHERE key = 'fiscal_settings'");
    await admin.end();
  });

  it("refuses to sell until a fiscal status is chosen", async () => {
    await admin.query("DELETE FROM catalog_store_settings WHERE key = 'fiscal_settings'");
    await expect(counter.placeCounterOrder({ request: randomUUID(), name: "", tender: "cash", member: "", lines: [line] }, "staff-1")).rejects.toMatchObject({ code: "FISCAL" });
  });

  it("records a paid, completed counter order with server pricing and tax, idempotently, outside pickup capacity", async () => {
    await setFiscal(fiscalSchema.parse({ status: "registered", legalName: "Test Shop Inc.", gstNumber: "123456789 RT 0001", qstNumber: "1234567890 TQ 0001" }));
    const request = randomUUID();
    const input = { request, name: "Walk-in", tender: "cash" as const, member: "", lines: [line] };
    const first = await counter.placeCounterOrder(input, "staff-1");
    expect(first.total).toBeGreaterThan(1300);
    const { rows: [order] } = await admin.query("SELECT status, payment, channel, counter_tender, created_by, total, tax_cents FROM orders WHERE number = $1", [first.number]);
    expect(order).toMatchObject({ status: "COMPLETED", payment: "PAID_AT_PICKUP", channel: "COUNTER", counter_tender: "cash", created_by: "staff-1" });
    expect(order.total - order.tax_cents).toBe(1300);
    const { rows: events } = await admin.query("SELECT status FROM order_events WHERE order_number = $1 ORDER BY id", [first.number]);
    expect(events.map(row => row.status)).toEqual(["RECEIVED", "COMPLETED"]);
    expect((await counter.placeCounterOrder(input, "staff-1")).number).toBe(first.number);
    await expect(counter.placeCounterOrder({ ...input, name: "Other" }, "staff-1")).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects unknown members and drinks that are not offered", async () => {
    await expect(counter.placeCounterOrder({ request: randomUUID(), name: "", tender: "terminal", member: "nobody@example.invalid", lines: [line] }, "staff-1")).rejects.toMatchObject({ code: "MEMBER" });
    await expect(counter.placeCounterOrder({ request: randomUUID(), name: "", tender: "terminal", member: "", lines: [{ ...line, product: "does-not-exist" }] }, "staff-1")).rejects.toMatchObject({ code: "MENU" });
  });
});
