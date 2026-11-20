// Admin completeness: dashboard, shared navigation, customers list/detail, counter (in-person) sale, analytics notice.
// Same fixture as instant-journey-smoke.mjs (disposable database, ADMIN admin@example.invalid / AdminPassw0rd!x, priced and offered catalog,
// fiscal status chosen, app with SALUT_INSTANT_ACCOUNTS=1).
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3100";
const stamp = Date.now();
const customer = { name: `Cliente ${stamp}`, email: `cli-${stamp}@example.invalid`, password: "ClientePassw0rd!x" };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" });

try {
  const shopper = await (await browser.newContext()).newPage();
  await shopper.goto(`${BASE}/fr/account`);
  const reg = shopper.locator('form[aria-labelledby="register-title"]');
  await reg.getByLabel("Prénom et nom").fill(customer.name);
  await reg.getByLabel("Courriel").fill(customer.email);
  await reg.getByLabel(/Mot de passe/).fill(customer.password);
  await reg.getByRole("checkbox").check();
  await reg.getByRole("button", { name: "Créer mon compte" }).click();
  await shopper.getByText("Compte créé").waitFor();
  const login = shopper.locator('form[aria-labelledby="login-title"]');
  await login.getByLabel("Courriel").fill(customer.email);
  await login.getByLabel("Mot de passe").fill(customer.password);
  await login.getByRole("button", { name: "Se connecter" }).click();
  await shopper.getByRole("button", { name: /Adhérer à Récompenses Salut/ }).click();

  const admin = await (await browser.newContext()).newPage();
  await admin.goto(`${BASE}/en/staff`);
  await admin.getByLabel("Email").fill("admin@example.invalid");
  await admin.getByLabel("Password").fill("AdminPassw0rd!x");
  await admin.getByRole("button", { name: "Sign in" }).click();
  // The administrator lands on the dashboard, with the shared navigation visible.
  await admin.getByRole("heading", { name: "Administration" }).waitFor();
  const side = admin.getByRole("navigation", { name: "Administration navigation" });
  await side.getByRole("link", { name: "Counter sale" }).waitFor();
  // The console has its own frame: no public header or footer, and a way back to the site.
  assert.equal(await admin.locator("header.top").count(), 0);
  assert.equal(await admin.locator("footer.bottom").count(), 0);
  await admin.getByRole("link", { name: /Back to the website/ }).first().waitFor();
  await admin.goto(`${BASE}/en/staff`);
  await side.getByRole("link", { name: "Orders" }).waitFor();

  // Dashboard and navigation (the console is English only): every section opens and shows the shared bar.
  await admin.goto(`${BASE}/en/admin`);
  await admin.getByRole("heading", { name: "Administration" }).waitFor();
  await admin.getByText("Today").waitFor();
  for (const [label, heading] of [["Products and catalog", /Edit the catalog/], ["Prices", /Price sheet/], ["Hours and pickup", /Business hours and pickup/], ["Profile and tax", /Business and tax/],
    ["Customers", /^Customers$/], ["Analytics", /Audience analytics/], ["Campaigns", /Campaigns/], ["Team and access", /Team and access/]]) {
    await side.getByRole("link", { name: label, exact: true }).click();
    await admin.getByRole("heading", { level: 1, name: heading }).waitFor();
  }
  await admin.goto(`${BASE}/en/admin/analytics`);
  await admin.getByText(/Audience measurement is switched off|No activity/).first().waitFor();

  // Counter sale linked to the customer, recorded as paid and completed.
  await admin.goto(`${BASE}/en/staff/counter`);
  await admin.getByLabel("Search").fill("matcha milk");
  await admin.getByRole("button", { name: "Matcha Milk Tea" }).click();
  await admin.getByRole("button", { name: "Add to the order" }).click();
  await admin.getByText(/1 × Matcha Milk Tea/).waitFor();
  await admin.getByLabel(/Rewards customer/).fill(customer.email);
  await admin.getByLabel("Payment method").selectOption("cash");
  await admin.getByRole("button", { name: /Record the sale/ }).click();
  await admin.getByText(/Sale #\d+ recorded/).waitFor();

  // A second sale to an unknown member is refused without creating an order.
  await admin.getByLabel("Search").fill("matcha milk");
  await admin.getByRole("button", { name: "Matcha Milk Tea" }).click();
  await admin.getByRole("button", { name: "Add to the order" }).click();
  await admin.getByLabel(/Rewards customer/).fill("inconnu@example.invalid");
  await admin.getByRole("button", { name: /Record the sale/ }).click();
  await admin.getByText("No Rewards customer matches").waitFor();

  // The order is listed as a counter order, and appears on the customer's detail page.
  await admin.goto(`${BASE}/en/staff`);
  await admin.getByText(/Counter · Completed/).first().waitFor();
  await admin.goto(`${BASE}/en/admin/customers?q=${stamp}`);
  await admin.getByRole("link", { name: customer.name }).click();
  await admin.getByRole("heading", { name: customer.name }).waitFor();
  await admin.getByText(/Completed.*counter/).waitFor();
  await admin.goto(`${BASE}/en/admin`);
  await admin.getByText("7 days · counter").waitFor();

  // Customers cannot reach any of it.
  for (const path of ["/en/admin/customers", "/en/staff/counter"]) assert.equal((await shopper.goto(`${BASE}${path}`))?.status(), 404);
  console.log("admin complete smoke: ok");
} finally {
  await browser.close();
}
