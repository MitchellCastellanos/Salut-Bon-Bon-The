import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import pg from "pg";

const { CATALOG_SMOKE_DATABASE_URL, CATALOG_SMOKE_BASE_URL } = process.env;
if (!CATALOG_SMOKE_DATABASE_URL || !CATALOG_SMOKE_BASE_URL) {
  throw new Error("Set CATALOG_SMOKE_DATABASE_URL and CATALOG_SMOKE_BASE_URL for a disposable imported test database and its app.");
}
const base = new URL(CATALOG_SMOKE_BASE_URL);
const db = new URL(CATALOG_SMOKE_DATABASE_URL);
assert.ok(["127.0.0.1", "localhost"].includes(base.hostname));
assert.ok(["127.0.0.1", "localhost"].includes(db.hostname));
const pool = new pg.Pool({ connectionString: db.href });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(new URL("/fr", base).href);
  if (process.env.CATALOG_SMOKE_ANALYTICS === "1") {
    assert.equal((await pool.query("SELECT count(*)::int AS total FROM marketing_events")).rows[0].total, 0);
    await page.getByRole("button", { name: "Mesure d’audience facultative" }).click();
    await page.getByRole("button", { name: "Mesure d’audience facultative", pressed: true }).waitFor();
  }
  await page.getByRole("link", { name: "Découvrir la série" }).click();
  await page.waitForURL("**/fr/catalog/fresh-mango-series");
  await page.getByRole("heading", { name: "Série Mangue Fraîche" }).waitFor();
  assert.equal(await page.locator(".catalog-grid li").count(), 5);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.goto(new URL("/en/catalog/house-lemonade", base).href);
  assert.equal(await page.locator(".catalog-grid li").count(), 6);
  await page.getByRole("link", { name: "Pineapple Lemonade" }).click();
  await page.getByText("Unavailable for online ordering.").waitFor();

  await pool.query("UPDATE catalog_products SET available = true WHERE id = '401'");
  await pool.query(`INSERT INTO catalog_variants
    (product_id, id, fr, en, price_cents, approved, available)
    VALUES ('401', 'regular', 'Régulier', 'Regular', 500, true, true)`);
  await pool.query("UPDATE catalog_modifiers SET available = true, surcharge_cents = 50 WHERE id = 'tapioca-tapioca'");
  await pool.query("INSERT INTO catalog_product_modifier_groups VALUES ('401', 'tapioca', 1, 1)");
  await pool.query("INSERT INTO catalog_product_modifiers VALUES ('401', 'tapioca', 'tapioca-tapioca', false)");
  const hours = Object.fromEntries(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => [day, [["00:00", "24:00"]]]));
  await pool.query("INSERT INTO catalog_store_settings VALUES ('pickup_checkout_enabled', 'true'), ('pickup_policy', $1::jsonb)",
    [JSON.stringify({ leadMinutes: 15, slotCapacity: 1, hours, taxRates: [1000] })]);
  await page.goto(new URL("/en/catalog?category=matcha", base).href);
  assert.equal(await page.locator(".catalog-grid li").count(), 3);
  await page.locator("#order-401").getByRole("button", { name: /customize/i }).click();
  await page.getByLabel("Quantity").fill("2");
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.getByRole("alert").getByText("Check the number of selected options.").waitFor();
  await page.getByLabel(/Tapioca/).check();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.reload();
  await page.locator("#cart").getByText("2 × Matcha Milk Tea").waitFor();
  assert.equal(await page.locator("#header-cart-count").textContent(), "2");

  // A price update after the cart is rendered must require confirmation.
  await pool.query("UPDATE catalog_variants SET price_cents = 550 WHERE product_id = '401'");
  await page.getByLabel("Pickup name").fill("Synthetic Catalog Smoke");
  await page.getByLabel("Pickup time").locator("option").nth(1).waitFor({ state: "attached" });
  const slot = await page.getByLabel("Pickup time").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Place order" }).click();
  await page.getByRole("alert").filter({ hasText: "The price changed" }).waitFor();
  await page.locator("#cart .total").getByText("$12.12").waitFor();
  assert.equal((await pool.query("SELECT count(*)::int AS total FROM orders WHERE customer = $1", ["Synthetic Catalog Smoke"])).rows[0].total, 0);
  await page.getByRole("button", { name: "Place order" }).click();
  await page.waitForURL(/\/en\/track\/[a-f0-9]+$/);
  await page.getByRole("status").filter({ hasText: "Received" }).waitFor();
  const { rows: [order] } = await pool.query("SELECT total, tax_cents, items FROM orders WHERE tracking_token = $1", [page.url().split("/").at(-1)]);
  assert.equal(order.total, 1212);
  assert.equal(order.tax_cents, 12);
  assert.deepEqual(order.items[0].name, { fr: "Matcha au lait", en: "Matcha Milk Tea" });
  assert.equal(order.items[0].selectedModifiers[0].id, "tapioca-tapioca");
  await page.goto(new URL("/en/catalog", base).href);
  await page.locator("#order-401").getByRole("button", { name: /customize/i }).click();
  await page.getByLabel(/Tapioca/).check();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.getByLabel("Pickup time").locator("option").nth(1).waitFor({ state: "attached" });
  assert.equal(await page.getByLabel("Pickup time").locator(`option[value="${slot[0]}"]`).count(), 0);
  if (process.env.CATALOG_SMOKE_ANALYTICS === "1") {
    const { rows } = await pool.query("SELECT event, campaign_id FROM marketing_events");
    assert.ok(rows.some(row => row.event === "hero_click" && row.campaign_id === "fresh-mango-series"));
    assert.ok(rows.some(row => row.event === "completed_order" && row.campaign_id === "fresh-mango-series"));
  }
  console.log("Catalog browser smoke passed: campaign links, mobile layout, availability guard, persistent cart, server pricing, snapshots and tracking.");
} finally {
  await browser.close();
  await pool.end();
}
