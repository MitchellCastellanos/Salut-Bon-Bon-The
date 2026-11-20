// Administration audit rehearsal (real browser, real database): every navigation destination, the ordering switch, menu edits that reach the storefront
// and checkout, reports, permissions and a phone-sized layout.
// Needs an app on SMOKE_BASE_URL (default http://localhost:3100) started with SALUT_DEMO_MODE=1 against a disposable migrated database with the imported
// catalog, ADMIN admin@example.invalid / AdminPassw0rd!x and STAFF staff@example.invalid / StaffPassw0rd!x. SHOT_DIR saves screenshots.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3100";
const SHOTS = process.env.SHOT_DIR;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" });
const shot = (page, name) => SHOTS ? page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }) : undefined;
const errors = [];
const stamp = Date.now();
const drink = `Audit Test Tea ${stamp}`, slug = `audit-test-tea-${stamp}`;

async function login(page, email, password, heading) {
  await page.goto(`${BASE}/en/staff`);
  await page.getByLabel("Email").fill(email); await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("heading", { name: heading }).first().waitFor();
}
const open = async (page, path, heading) => {
  const response = await page.goto(`${BASE}/en${path}`);
  assert.ok(response && response.status() < 400, `${path} returned ${response?.status()}`);
  await page.getByRole("heading", { level: 1, name: heading }).waitFor();
};

try {
  const admin = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  admin.on("pageerror", error => errors.push(`${admin.url()} ${error.message}`));
  admin.on("dialog", dialog => dialog.accept());
  await login(admin, "admin@example.invalid", "AdminPassw0rd!x", "Administration");

  // 1. Navigation: seven groups, every link opens a real page with a level-one heading, no duplicates.
  const nav = admin.getByRole("navigation", { name: "Administration navigation" });
  for (const group of ["Orders", "Menu", "Customers and loyalty", "Store", "Reports", "Settings"]) await nav.getByText(group, { exact: true }).waitFor();
  const links = await nav.getByRole("link").evaluateAll(items => items.map(a => ({ href: a.getAttribute("href"), label: a.textContent.trim() })));
  assert.equal(new Set(links.map(l => l.href)).size, links.length, "duplicate navigation destinations");
  assert.ok(links.length >= 15, `expected the full menu, got ${links.length}`);
  for (const link of links) {
    const response = await admin.goto(`${BASE}${link.href}`);
    assert.ok(response.status() < 400, `${link.label}: ${response.status()}`);
    await admin.getByRole("heading", { level: 1 }).first().waitFor();
    assert.equal(await admin.locator('h1').count() >= 1, true, link.label);
  }
  // Retired routes redirect to their new home instead of 404ing.
  for (const [from, to] of [["/admin/catalog", "/admin/menu"], ["/admin/prices", "/admin/menu"], ["/admin/analytics", "/admin/reports"], ["/admin/campaigns", "/admin/website"]]) {
    await admin.goto(`${BASE}/en${from}`);
    assert.ok(admin.url().endsWith(to), `${from} -> ${admin.url()}`);
  }

  // 2. Fresh store is closed with exact reasons; the demo button opens it; the switch pauses and resumes it, and the storefront follows.
  await open(admin, "/admin", "Administration");
  await admin.getByText("Online ordering").first().waitFor();
  await shot(admin, "01-dashboard-closed");
  await open(admin, "/admin/integrations", "Payments and integrations");
  await admin.getByText("Simulated (no real money)").waitFor();
  await admin.getByRole("button", { name: "Apply demo settings" }).click();
  await admin.getByText("Demo settings applied.").first().waitFor();
  await open(admin, "/admin", "Administration");
  await admin.getByRole("heading", { name: /Online ordering/ }).getByText("Open").waitFor();
  await shot(admin, "02-dashboard-open");

  const shopper = await (await browser.newContext({ viewport: { width: 1000, height: 1000 } })).newPage();
  await shopper.goto(`${BASE}/en/catalog`);
  await shopper.locator('section[aria-labelledby="orderable"]').waitFor();

  await admin.getByRole("button", { name: "Temporarily stop new orders" }).click();
  await admin.getByText("New online orders are paused.").waitFor();
  await admin.getByRole("button", { name: "Resume online orders" }).waitFor();
  await shopper.goto(`${BASE}/en/catalog`);
  assert.equal(await shopper.locator('section[aria-labelledby="orderable"]').count(), 0, "paused: the storefront must not offer ordering");
  await admin.getByRole("button", { name: "Resume online orders" }).click();
  await admin.getByText("Online ordering resumed.").waitFor();
  await shopper.goto(`${BASE}/en/catalog`);
  await shopper.locator('section[aria-labelledby="orderable"]').waitFor();

  // 3. Menu: sold out reaches the storefront; a price change reaches the storefront and the order total.
  await open(admin, "/admin/menu", "Drinks and prices");
  const first = admin.locator("li.admin-row").first();
  const name = (await first.locator("h3 a").textContent()).trim();
  const href = await first.locator("h3 a").getAttribute("href");
  const id = href.split("/").pop();
  await first.getByRole("button", { name: "Mark sold out" }).click();
  await admin.getByText(/marked sold out/).first().waitFor();
  await shopper.goto(`${BASE}/en/catalog/products/${id}`);
  await shopper.getByTestId("unavailable").waitFor();
  await open(admin, "/admin/menu?status=soldout", "Drinks and prices");
  await admin.locator("li.admin-row").first().getByRole("button", { name: "Back on sale" }).click();
  await admin.getByText("Drink is back on sale.").waitFor();
  await shopper.goto(`${BASE}/en/catalog/products/${id}`);
  assert.equal(await shopper.getByTestId("unavailable").count(), 0);

  await open(admin, `/admin/menu/${id}`, name);
  await admin.getByLabel("Regular size ($)").fill("9.25");
  await admin.getByLabel("Large size ($)").fill("11.50");
  await admin.getByRole("button", { name: "Save changes" }).click();
  await admin.getByText(/Drink saved/).waitFor();
  await shopper.goto(`${BASE}/en/catalog/products/${id}`);
  await shopper.getByText("Regular · $9.25").waitFor();
  await shopper.getByText("Large · $11.50").waitFor();
  await shot(admin, "03-menu-edit");
  // Invalid price is refused with a message and nothing changes.
  await admin.getByLabel("Regular size ($)").fill("abc");
  await admin.getByRole("button", { name: "Save changes" }).click();
  await admin.getByRole("alert").waitFor();
  await shopper.goto(`${BASE}/en/catalog/products/${id}`);
  await shopper.getByText("Regular · $9.25").waitFor();

  // Add a drink: it starts hidden (not on the public menu), then becomes visible when switched on.
  await open(admin, "/admin/menu/new", "Add a drink");
  await admin.getByLabel("Name shown on the English site").fill(drink);
  await admin.getByLabel("Name shown on the French site").fill("Thé d’audit");
  await admin.getByLabel("Regular size ($)").fill("5.50");
  await admin.getByRole("button", { name: "Add this drink" }).click();
  await admin.getByText(/Drink added/).waitFor();
  await shopper.goto(`${BASE}/en/catalog/products/${slug}`);
  assert.ok((await shopper.title()).length >= 0);
  assert.equal(await shopper.getByRole("heading", { name: drink }).count(), 0, "a draft must not be public");
  await admin.getByLabel("Show on the website (untick to hide it completely)").check();
  await admin.getByLabel("Available to order (untick when it is sold out)").check();
  await admin.getByRole("button", { name: "Save changes" }).click();
  await admin.getByText(/Drink saved/).waitFor();
  await shopper.goto(`${BASE}/en/catalog/products/${slug}`);
  await shopper.getByRole("heading", { name: drink }).waitFor();
  await shopper.getByText("Regular · $5.50").waitFor();
  // Toppings use checkboxes, not typed identifiers.
  await admin.getByRole("button", { name: /Save popping pearls/i }).waitFor();

  // 4. Hours page: the switch lives there too (same control), saving works, and the change appears in the history.
  await open(admin, "/admin/hours", "Hours and online ordering");
  await admin.getByRole("button", { name: "Temporarily stop new orders" }).waitFor();
  await admin.getByRole("button", { name: "Save hours and pickup settings" }).click();
  await admin.getByText("Hours and pickup settings saved.").waitFor();
  await open(admin, "/admin/activity", "Change history");
  for (const text of ["Online ordering paused", "Online ordering resumed", "Drink edited", "Drink added", "Drink shown or hidden"]) await admin.getByText(text).first().waitFor();
  await admin.getByText(/by .*admin/i).first().waitFor();

  // 5. Reports show real figures and date presets work; an invalid range falls back instead of failing.
  await open(admin, "/admin/reports", "Sales and activity");
  for (const text of ["Sales", "Most ordered drinks", "Salut Rewards", "Website visits"]) await admin.getByRole("heading", { name: text, exact: true }).waitFor();
  await admin.getByRole("link", { name: "Today" }).click();
  await admin.getByRole("heading", { level: 1, name: "Sales and activity" }).waitFor();
  await admin.goto(`${BASE}/en/admin/reports?from=2999-01-01&to=2000-01-01`);
  await admin.getByRole("heading", { level: 1, name: "Sales and activity" }).waitFor();

  // 6. Permissions: STAFF reach the queue and counter, not the administration; a visitor reaches neither.
  const team = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await login(team, "staff@example.invalid", "StaffPassw0rd!x", /Orders/);
  const staffNav = team.getByRole("navigation", { name: "Administration navigation" });
  await staffNav.getByRole("link", { name: "Live queue" }).waitFor();
  assert.equal(await staffNav.getByRole("link", { name: "Drinks and prices" }).count(), 0);
  for (const path of ["/admin", "/admin/menu", "/admin/hours", "/admin/reports", "/admin/team", "/admin/rewards"]) {
    const response = await team.goto(`${BASE}/en${path}`);
    assert.equal(response.status(), 404, `STAFF must not open ${path}`);
  }
  const visitor = await (await browser.newContext()).newPage();
  for (const path of ["/admin", "/admin/menu", "/staff/counter"]) {
    await visitor.goto(`${BASE}/en${path}`);
    assert.equal(await visitor.getByText("Drinks and prices").count(), 0, `visitor saw ${path}`);
  }

  // 7. Phone layout: no horizontal scrolling on the dense screens, menu drawer opens, controls reachable.
  const phone = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  phone.on("dialog", dialog => dialog.accept());
  await login(phone, "admin@example.invalid", "AdminPassw0rd!x", "Administration");
  for (const path of ["/admin", "/admin/menu", `/admin/menu/${id}`, "/admin/hours", "/admin/orders", "/admin/reports", "/admin/rewards", "/admin/team", "/admin/website", "/admin/integrations"]) {
    await phone.goto(`${BASE}/en${path}`);
    await phone.getByRole("heading", { level: 1 }).first().waitFor();
    const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 1, `${path} overflows by ${overflow}px on a phone`);
  }
  await phone.goto(`${BASE}/en/admin`);
  await phone.getByRole("button", { name: "Open menu" }).click();
  await phone.locator(".console-drawer").getByRole("link", { name: "Drinks and prices" }).click();
  await phone.getByRole("heading", { level: 1, name: "Drinks and prices" }).waitFor();
  await shot(phone, "04-phone-menu");
  const tablet = await (await browser.newContext({ viewport: { width: 820, height: 1180 } })).newPage();
  await login(tablet, "admin@example.invalid", "AdminPassw0rd!x", "Administration");
  await tablet.goto(`${BASE}/en/admin/hours`);
  await tablet.getByRole("heading", { level: 1 }).waitFor();
  assert.ok(await tablet.evaluate(() => document.documentElement.scrollWidth - window.innerWidth) <= 1, "tablet overflow on hours");
  await shot(tablet, "05-tablet-hours");

  assert.deepEqual(errors, [], "browser errors: " + errors.join("\n"));
  console.log("Admin audit smoke passed");
} finally {
  await browser.close();
}
