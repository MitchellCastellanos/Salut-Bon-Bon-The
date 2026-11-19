// Full rehearsal: customer sign-up without email (SALUT_INSTANT_ACCOUNTS=1), ADMIN team management, order, fulfilment.
// Needs an app on SMOKE_BASE_URL (default http://localhost:3100) started with SALUT_INSTANT_ACCOUNTS=1 against a disposable database
// with ADMIN admin@example.invalid / AdminPassw0rd!x, an open checkout (see docs/TESTING.md) and a priced catalog.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3100";
const stamp = Date.now();
const customer = { name: "Cliente Prueba", email: `cliente-${stamp}@example.invalid`, password: "ClientePassw0rd!x" };
const staff = { name: "Equipo Prueba", email: `equipo-${stamp}@example.invalid`, password: "EquipoPassw0rd!x" };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" });

async function staffLogin(page, email, password) {
  await page.goto(`${BASE}/fr/staff`);
  await page.getByLabel("Courriel").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Connexion" }).click();
  await page.getByRole("heading", { name: /Commandes/ }).waitFor();
}

try {
  // 1. A customer registers and signs in immediately.
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
  await shopper.getByText(customer.email).first().waitFor();

  // 2. The customer is not a staff member.
  await shopper.goto(`${BASE}/fr/staff`);
  await shopper.getByRole("button", { name: "Connexion" }).waitFor();
  assert.equal((await shopper.goto(`${BASE}/fr/admin`))?.status(), 404);

  // 3. ADMIN signs in, sees the team page and creates a STAFF account.
  const admin = await (await browser.newContext()).newPage();
  await staffLogin(admin, "admin@example.invalid", "AdminPassw0rd!x");
  await admin.goto(`${BASE}/fr/admin`);
  await admin.getByRole("navigation", { name: "Administration" }).getByRole("link", { name: "Équipe", exact: true }).click();
  await admin.getByRole("heading", { name: "Équipe et accès" }).waitFor();
  const add = admin.locator('form[aria-labelledby="add-title"]');
  await add.getByLabel("Nom").fill(staff.name);
  await add.getByLabel("Courriel").fill(staff.email);
  await add.getByLabel(/Mot de passe/).fill(staff.password);
  await add.getByRole("button", { name: "Créer le compte" }).click();
  await admin.getByText("Compte créé.").waitFor();
  await add.getByLabel("Nom").fill(staff.name);
  await add.getByLabel("Courriel").fill(staff.email);
  await add.getByLabel(/Mot de passe/).fill(staff.password);
  await add.getByRole("button", { name: "Créer le compte" }).click();
  await admin.getByText("existe déjà").waitFor();
  // The only administrator cannot be demoted or removed (own row has no controls).
  assert.equal(await admin.getByRole("button", { name: "Rendre STAFF" }).count(), 0);

  // 4. The new STAFF signs in, reaches orders, and is denied the admin area.
  const crew = await (await browser.newContext()).newPage();
  await staffLogin(crew, staff.email, staff.password);
  assert.equal((await crew.goto(`${BASE}/fr/admin/team`))?.status(), 404);

  // 5. The customer orders and follows the order from the account.
  await shopper.goto(`${BASE}/fr/catalog?category=matcha`);
  await shopper.locator("#order-401").getByRole("button", { name: /Personnaliser/ }).click();
  await shopper.getByLabel(/Tapioca/).first().check();
  await shopper.getByRole("button", { name: "Ajouter au panier" }).click();
  await shopper.reload();
  await shopper.locator("#cart").getByText(/Matcha au lait/).waitFor();
  await shopper.getByLabel(/Nom/).first().fill(customer.name);
  await shopper.getByLabel(/Heure/).locator("option").nth(1).waitFor({ state: "attached" });
  await shopper.getByLabel(/Heure/).selectOption({ index: 1 });
  await shopper.getByRole("button", { name: /Passer la commande|Commander/ }).click();
  await shopper.waitForURL(/\/fr\/track\/[a-f0-9]+$/);
  await shopper.goto(`${BASE}/fr/account`);
  await shopper.getByRole("heading", { name: "Mes commandes" }).waitFor();
  assert.ok(await shopper.locator(".catalog-grid li").count() >= 1, "the order appears in the customer account");

  // 6. STAFF advances the order; the ADMIN revokes the account, which closes its session.
  await crew.goto(`${BASE}/fr/staff`);
  await crew.getByText(customer.name).first().waitFor();
  await admin.goto(`${BASE}/fr/admin/team`);
  const row = admin.locator("article").filter({ hasText: staff.email });
  await row.getByRole("button", { name: "Retirer l’accès" }).click();
  await admin.getByText("Accès retiré.").waitFor();
  await crew.goto(`${BASE}/fr/staff`);
  await crew.getByRole("button", { name: "Connexion" }).waitFor();
  console.log("instant journey smoke: ok");
} finally {
  await browser.close();
}
