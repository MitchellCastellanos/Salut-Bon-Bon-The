import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";

const local = vi.hoisted(() => ({ current: undefined as PGlite | undefined }));
vi.mock("../src/db", async () => {
  local.current = new PGlite();
  await (await vi.importActual<typeof import("../src/db")>("../src/db")).applyLocalMigrations(local.current);
  return { database: async () => local.current };
});
import * as menu from "../src/admin-menu";
import { attention, presets, report, reportRange, setOrderingEnabled } from "../src/admin-reports";
import { officialPrices } from "../src/catalog-pricing";
import { pickupConfiguration } from "../src/store-settings";

const q = async (sql: string, args: unknown[] = []) => (await local.current!.query<Record<string, unknown>>(sql, args)).rows;
afterAll(async () => local.current?.close());

beforeAll(async () => {
  await q("INSERT INTO catalog_categories (id, fr, en) VALUES ('milk-tea', 'Thé au lait', 'Milk tea'), ('matcha', 'Matcha', 'Matcha')");
  await q("INSERT INTO catalog_modifier_groups (id) VALUES ('jelly'), ('tapioca')");
  await q(`INSERT INTO catalog_modifiers (id, group_id, fr, en, available, surcharge_cents) VALUES
    ('jelly-aloe', 'jelly', 'Aloès', 'Aloe', true, 100), ('jelly-mango', 'jelly', 'Mangue', 'Mango', true, 100), ('tapioca-tapioca', 'tapioca', 'Tapioca', 'Tapioca', true, 100)`);
  await q("INSERT INTO catalog_products (id, category, available) VALUES ('taro', 'milk-tea', true)");
  await q("INSERT INTO catalog_product_translations VALUES ('taro', 'fr', 'Taro'), ('taro', 'en', 'Taro')");
  await q("INSERT INTO catalog_variants (product_id, id, fr, en, price_cents, approved, available) VALUES ('taro', 'regular', 'Régulier', 'Regular', 599, true, true)");
  await q("INSERT INTO catalog_product_modifier_groups VALUES ('taro', 'jelly', 0, 2)");
  await q("INSERT INTO catalog_product_modifiers VALUES ('taro', 'jelly', 'jelly-aloe', false)");
});

describe("menu administration", () => {
  it("marks a product sold out and back on sale with an audit line naming the actor", async () => {
    await menu.setProductAvailable("taro", false, "admin:ada");
    expect((await q("SELECT available FROM catalog_products WHERE id = 'taro'"))[0].available).toBe(false);
    expect((await officialPrices(true)).some(row => row.id === "taro")).toBe(false);
    await menu.setProductAvailable("taro", true, "admin:ada");
    expect((await officialPrices(true)).some(row => row.id === "taro")).toBe(true);
    const [row] = await q("SELECT details FROM catalog_audit_history WHERE action = 'availability.update' ORDER BY id DESC LIMIT 1");
    expect((row.details as { actor: string }).actor).toBe("admin:ada");
    await expect(menu.setProductAvailable("nope", true, "x")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("parses dollars strictly", () => {
    expect(menu.parseDollars("6.75")).toBe(675);
    expect(menu.parseDollars("7")).toBe(700);
    expect(menu.parseDollars("")).toBeNull();
    for (const bad of ["-1", "6,75", "abc", "0", "1000", "1.234"]) expect(() => menu.parseDollars(bad)).toThrow();
  });

  it("saves a price, which becomes the checkout price, and clears a size", async () => {
    await menu.saveProduct({ id: "taro", fr: "Taro", en: "Taro", category: "milk-tea", image: "", featured: null, published: true, available: true, regular: 675, large: 775, regularPromo: 575, largePromo: null }, "admin:ada");
    const prices = await officialPrices(true);
    expect(prices.find(row => row.id === "taro" && row.size === "regular")?.cents).toBe(575);
    expect(prices.find(row => row.id === "taro" && row.size === "large")?.cents).toBe(775);
    await menu.saveProduct({ id: "taro", fr: "Taro", en: "Taro", category: "milk-tea", image: "", featured: null, published: true, available: true, regular: 675, large: null, regularPromo: null, largePromo: null }, "admin:ada");
    const after = await officialPrices(true);
    expect(after.find(row => row.id === "taro" && row.size === "large")).toBeUndefined();
    expect(after.find(row => row.id === "taro" && row.size === "regular")?.cents).toBe(675);
  });

  it("rejects invalid products without partial writes", async () => {
    const base = { id: "taro", fr: "Taro", en: "Taro", category: "milk-tea", image: "", featured: null, published: true, available: true, regular: 675, large: null, regularPromo: null, largePromo: null };
    await expect(menu.saveProduct({ ...base, regularPromo: 700 }, "a")).rejects.toMatchObject({ code: "INVALID" });
    await expect(menu.saveProduct({ ...base, category: "ghost" }, "a")).rejects.toMatchObject({ code: "INVALID" });
    await expect(menu.saveProduct({ ...base, image: "/etc/passwd" }, "a")).rejects.toMatchObject({ code: "INVALID" });
    await expect(menu.saveProduct({ ...base, en: "   " }, "a")).rejects.toMatchObject({ code: "INVALID" });
    await expect(menu.saveProduct({ ...base, id: "ghost" }, "a")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await q("SELECT price_cents FROM catalog_variants WHERE product_id = 'taro' AND id = 'regular'"))[0].price_cents).toBe(675);
  });

  it("creates a product hidden or offered, copying toppings from the same category", async () => {
    const id = await menu.createProduct({ fr: "Thé noir", en: "Black Tea", category: "milk-tea", image: "", available: true, regular: 550, large: 650, regularPromo: null, largePromo: null }, "admin:ada");
    expect(id).toBe("black-tea");
    const toppings = await q("SELECT modifier_id FROM catalog_product_modifiers WHERE product_id = 'black-tea'");
    expect(toppings.map(row => row.modifier_id)).toEqual(["jelly-aloe"]);
    expect((await officialPrices(true)).some(row => row.id === "black-tea" && row.size === "large")).toBe(true);
    await expect(menu.createProduct({ fr: "x", en: "Black Tea", category: "milk-tea", image: "", available: false, regular: null, large: null, regularPromo: null, largePromo: null }, "a")).rejects.toMatchObject({ code: "EXISTS" });
    const hidden = await menu.createProduct({ fr: "Brouillon", en: "Draft", category: "matcha", image: "", available: false, regular: null, large: null, regularPromo: null, largePromo: null }, "a");
    expect((await menu.listMenu()).find(row => row.id === hidden)).toMatchObject({ available: false, published: false });
    expect((await officialPrices(true)).some(row => row.id === hidden)).toBe(false);
  });

  it("filters the list by status, category and text", async () => {
    expect((await menu.listMenu({ status: "hidden" })).map(row => row.id)).toEqual(["draft"]);
    await menu.setProductAvailable("black-tea", false, "a");
    expect((await menu.listMenu({ status: "soldout" })).map(row => row.id)).toEqual(["black-tea"]);
    await menu.setProductAvailable("black-tea", true, "a");
    expect((await menu.listMenu({ category: "matcha" })).map(row => row.id)).toEqual(["draft"]);
    expect((await menu.listMenu({ q: "black" })).map(row => row.id)).toEqual(["black-tea"]);
    const warnings = await menu.menuWarnings();
    expect(warnings.hidden).toBe(1);
    expect(warnings.soldout).toBe(0);
    expect(warnings.offered).toBe(2);
  });

  it("validates topping limits and eligibility", async () => {
    const ok = { product: "taro", group: "jelly", min: 0, max: 2, eligible: ["jelly-aloe", "jelly-mango"], defaults: ["jelly-aloe"] };
    await menu.saveToppings(ok, "admin:ada");
    expect((await q("SELECT modifier_id, selected_by_default FROM catalog_product_modifiers WHERE product_id = 'taro' ORDER BY 1")).length).toBe(2);
    await menu.saveToppings({ ...ok, max: 1, eligible: ["jelly-mango"], defaults: [] }, "admin:ada");
    expect((await q("SELECT modifier_id FROM catalog_product_modifiers WHERE product_id = 'taro'")).map(row => row.modifier_id)).toEqual(["jelly-mango"]);
    await expect(menu.saveToppings({ ...ok, min: 3 }, "a")).rejects.toMatchObject({ code: "LIMITS" });
    await expect(menu.saveToppings({ ...ok, eligible: ["tapioca-tapioca"], max: 1, defaults: [] }, "a")).rejects.toMatchObject({ code: "INVALID" });
    await expect(menu.saveToppings({ ...ok, defaults: ["jelly-aloe", "jelly-mango", "x"] }, "a")).rejects.toMatchObject({ code: "LIMITS" });
  });

  it("creates categories and toppings and edits collections by product list", async () => {
    await menu.saveCategory({ id: "", fr: "Bulles", en: "Bubbles" }, "a", true);
    await expect(menu.saveCategory({ id: "", fr: "Bulles", en: "Bubbles" }, "a", true)).rejects.toMatchObject({ code: "EXISTS" });
    await menu.saveCategory({ id: "bubbles", fr: "Bulles!", en: "Bubbles!" }, "a", false);
    expect((await q("SELECT en FROM catalog_categories WHERE id = 'bubbles'"))[0].en).toBe("Bubbles!");
    const id = await menu.createTopping({ group: "jelly", fr: "Litchi", en: "Lychee", cents: 100, available: true }, "a");
    expect(id).toBe("jelly-lychee");
    await menu.saveTopping({ id, fr: "Litchi", en: "Lychee", cents: 150, available: false }, "a");
    expect((await q("SELECT surcharge_cents, available FROM catalog_modifiers WHERE id = 'jelly-lychee'"))[0]).toMatchObject({ surcharge_cents: 150, available: false });
    await q("INSERT INTO catalog_collections (id, fr, en) VALUES ('mango', 'Mangue', 'Mango')");
    await menu.saveCollection({ id: "mango", fr: "Mangue", en: "Mango", products: ["black-tea", "taro"] }, "a");
    expect((await q("SELECT product_id FROM catalog_collection_products WHERE collection_id = 'mango' ORDER BY position")).map(row => row.product_id)).toEqual(["black-tea", "taro"]);
    await menu.saveCollection({ id: "mango", fr: "Mangue", en: "Mango", products: ["taro"] }, "a");
    expect((await q("SELECT product_id FROM catalog_collection_products WHERE collection_id = 'mango'")).length).toBe(1);
    await expect(menu.saveCollection({ id: "mango", fr: "M", en: "M", products: ["ghost"] }, "a")).rejects.toMatchObject({ code: "INVALID" });
  });
});

describe("ordering switch", () => {
  it("pause closes online pricing and reports FLAG_OFF; counter sales still price", async () => {
    await setOrderingEnabled(true, "admin:ada");
    expect((await officialPrices(false)).length).toBeGreaterThan(0);
    await setOrderingEnabled(false, "admin:ada");
    expect(await officialPrices(false)).toEqual([]);
    expect((await officialPrices(true)).length).toBeGreaterThan(0);
    expect((await pickupConfiguration()).blockers).toContain("FLAG_OFF");
    const [row] = await q("SELECT action, details FROM catalog_audit_history WHERE action LIKE 'store.orders-%' ORDER BY id DESC LIMIT 1");
    expect(row.action).toBe("store.orders-paused");
    expect((row.details as { actor: string }).actor).toBe("admin:ada");
    await setOrderingEnabled(true, "admin:ada");
    expect((await pickupConfiguration()).blockers).not.toContain("FLAG_OFF");
  });
});

describe("reports", () => {
  const order = async (fields: { total: number; payment: string; status: string; items: unknown[]; channel?: string; when?: string; user?: string }) => {
    const [row] = await q(`INSERT INTO orders (request_id, request_fingerprint, tracking_token, locale, customer, notes, pickup_at, items, total, payment, status, channel, created_at, customer_user_id, counter_tender)
      VALUES ($1, 'f', $2, 'en', 'Test', '', now(), $3::jsonb, $4, $5, $6, $7, $8::timestamptz, $9, CASE WHEN $7 = 'COUNTER' THEN 'cash' END) RETURNING number::text AS number`,
      [randomUUID(), randomUUID() + randomUUID(), JSON.stringify(fields.items), fields.total, fields.payment, fields.status, fields.channel ?? "ONLINE", fields.when ?? new Date().toISOString(), fields.user ?? null]);
    return row.number as string;
  };
  const item = (product: string, quantity: number, subtotal: number) => ({ product, name: { fr: product, en: product.toUpperCase() }, quantity, subtotal, size: "regular" });

  it("range parsing falls back safely and presets cover today", () => {
    const now = new Date("2026-11-20T15:00:00Z");
    expect(reportRange({}, now)).toEqual({ from: "2026-10-22", to: "2026-11-20", preset: "30" });
    expect(reportRange({ preset: "today" }, now)).toMatchObject({ from: "2026-11-20", to: "2026-11-20" });
    expect(reportRange({ from: "2026-11-01", to: "2026-11-10" }, now)).toMatchObject({ preset: "custom" });
    expect(reportRange({ from: "2026-11-10", to: "2026-11-01" }, now).preset).toBe("30");
    expect(reportRange({ from: "2024-01-01", to: "2026-11-01" }, now).preset).toBe("30");
    expect(reportRange({ from: "2026-11-01", to: "2027-01-01" }, now).preset).toBe("30");
    expect(presets.map(p => p.id)).toContain("90");
  });

  it("counts real sales net of refunds, separates simulated payments and ranks products", async () => {
    const base = await report({ from: "2000-01-01", to: "2100-01-01", preset: "custom" });
    expect(base.orders.placed).toBe(0);
    await order({ total: 1000, payment: "PAID_ONLINE", status: "COMPLETED", items: [item("taro", 2, 1000)] });
    const refunded = await order({ total: 600, payment: "PAID_AT_PICKUP", status: "COMPLETED", items: [item("taro", 1, 600)], channel: "COUNTER" });
    await order({ total: 700, payment: "DEMO_PAID", status: "COMPLETED", items: [item("matcha", 1, 700)] });
    await order({ total: 900, payment: "UNPAID", status: "RECEIVED", items: [item("matcha", 1, 900)] });
    await order({ total: 500, payment: "REFUND_REQUIRED", status: "CANCELLED", items: [item("taro", 1, 500)] });
    await q("INSERT INTO order_refunds (order_number, amount_cents, reason, provider, actor, idempotency_key) VALUES ($1, 200, 'oops', 'manual', 'a', $2)", [refunded, `refund-${randomUUID()}`]);
    const r = await report({ from: "2000-01-01", to: "2100-01-01", preset: "custom" });
    expect(r.orders).toMatchObject({ placed: 5, completed: 3, open: 1, cancelled: 1, online: 3, counter: 1 });
    expect(r.sales).toMatchObject({ cents: 1000 + 600 - 200, refundedCents: 200, simulatedCents: 700, awaitingCents: 900 });
    expect(r.sales.averageCents).toBe(700);
    expect(r.products[0]).toMatchObject({ id: "taro", units: 3, cents: 1600 });
    expect(r.byDay.reduce((sum, row) => sum + row.orders, 0)).toBe(4);
    const empty = await report({ from: "2000-01-01", to: "2000-01-02", preset: "custom" });
    expect(empty.orders.placed).toBe(0);
    expect(empty.byDay).toEqual([]);
    const needs = await attention();
    expect(needs.received).toBe(1);
    expect(needs.refunds).toBe(1);
  });
});

describe("catalog codes", () => {
  it("accepts the uppercase and numeric product codes of the imported catalog", async () => {
    await q("INSERT INTO catalog_products (id, category, available) VALUES ('BRULEE-03', 'milk-tea', true), ('401', 'milk-tea', true)");
    await q("INSERT INTO catalog_product_translations VALUES ('BRULEE-03', 'fr', 'Brûlée'), ('BRULEE-03', 'en', 'Brulee'), ('401', 'fr', 'Quatre'), ('401', 'en', 'Four')");
    await menu.setProductAvailable("BRULEE-03", false, "a");
    await menu.saveProduct({ id: "401", fr: "Quatre", en: "Four", category: "milk-tea", image: "/catalog/MANGO-01.webp", featured: 3, published: true, available: true, regular: 600, large: null, regularPromo: null, largePromo: null }, "a");
    expect((await q("SELECT position FROM catalog_featured_placements WHERE product_id = '401'"))[0].position).toBe(3);
    expect((await q("SELECT available FROM catalog_products WHERE id = 'BRULEE-03'"))[0].available).toBe(false);
  });
});

describe("included topping safeguard", () => {
  it("refuses to remove the last tapioca or popping pearl from a drink", async () => {
    await q("INSERT INTO catalog_modifier_groups (id) VALUES ('popping') ON CONFLICT DO NOTHING");
    await q("INSERT INTO catalog_modifiers (id, group_id, fr, en, available, surcharge_cents) VALUES ('popping-kiwi', 'popping', 'Kiwi', 'Kiwi', true, 100) ON CONFLICT DO NOTHING");
    await q("INSERT INTO catalog_product_modifier_groups VALUES ('black-tea', 'popping', 0, 1)");
    await menu.saveToppings({ product: "black-tea", group: "popping", min: 0, max: 1, eligible: ["popping-kiwi"], defaults: [] }, "a");
    await expect(menu.saveToppings({ product: "black-tea", group: "popping", min: 0, max: 0, eligible: [], defaults: [] }, "a")).rejects.toMatchObject({ code: "LIMITS" });
    expect((await q("SELECT modifier_id FROM catalog_product_modifiers WHERE product_id = 'black-tea' AND group_id = 'popping'")).length).toBe(1);
  });
});
