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
  await admin.goto(`${BASE}/fr/staff`);
  await admin.getByLabel("Courriel").fill("admin@example.invalid");
  await admin.getByLabel("Mot de passe").fill("AdminPassw0rd!x");
  await admin.getByRole("button", { name: "Connexion" }).click();
  // The administrator lands on the dashboard, with the shared navigation visible.
  await admin.getByRole("heading", { name: "Administration" }).waitFor();
  const side = admin.getByRole("navigation", { name: "Navigation de l’administration" });
  await side.getByRole("link", { name: "Vente au comptoir" }).waitFor();
  // The console has its own frame: no public header or footer, and a way back to the site.
  assert.equal(await admin.locator("header.top").count(), 0);
  assert.equal(await admin.locator("footer.bottom").count(), 0);
  await admin.getByRole("link", { name: /Retour au site/ }).first().waitFor();
  await admin.goto(`${BASE}/fr/staff`);
  await side.getByRole("link", { name: "Commandes" }).waitFor();

  // Dashboard and navigation: every section opens and shows the shared bar.
  await admin.goto(`${BASE}/fr/admin`);
  await admin.getByRole("heading", { name: "Administration" }).waitFor();
  await admin.getByText("Aujourd’hui").waitFor();
  for (const [label, heading] of [["Produits et catalogue", /Modifier le catalogue/], ["Prix", /Feuille de prix/], ["Heures et cueillette", /Heures d’ouverture/], ["Profil et taxes", /Commerce et fiscalité/],
    ["Clients", /^Clients$/], ["Audience", /Mesure d’audience/], ["Campagnes", /Campagnes/], ["Équipe et accès", /Équipe et accès/]]) {
    await side.getByRole("link", { name: label, exact: true }).click();
    await admin.getByRole("heading", { level: 1, name: heading }).waitFor();
  }
  await admin.goto(`${BASE}/fr/admin/analytics`);
  await admin.getByText(/La mesure d’audience est désactivée|Aucune activité/).first().waitFor();

  // Counter sale linked to the customer, recorded as paid and completed.
  await admin.goto(`${BASE}/fr/staff/counter`);
  await admin.getByLabel("Rechercher").fill("matcha au lait");
  await admin.getByRole("button", { name: "Matcha au lait" }).click();
  await admin.getByRole("button", { name: "Ajouter à la commande" }).click();
  await admin.getByText(/1 × Matcha au lait/).waitFor();
  await admin.getByLabel(/Client Récompenses/).fill(customer.email);
  await admin.getByLabel("Mode de paiement").selectOption("cash");
  await admin.getByRole("button", { name: /Enregistrer la vente/ }).click();
  await admin.getByText(/Vente #\d+ enregistrée/).waitFor();

  // A second sale to an unknown member is refused without creating an order.
  await admin.getByLabel("Rechercher").fill("matcha au lait");
  await admin.getByRole("button", { name: "Matcha au lait" }).click();
  await admin.getByRole("button", { name: "Ajouter à la commande" }).click();
  await admin.getByLabel(/Client Récompenses/).fill("inconnu@example.invalid");
  await admin.getByRole("button", { name: /Enregistrer la vente/ }).click();
  await admin.getByText("Aucun client Récompenses ne correspond").waitFor();

  // The order is listed as a counter order, and appears on the customer's detail page.
  await admin.goto(`${BASE}/fr/staff`);
  await admin.getByText(/Comptoir · Terminée/).first().waitFor();
  await admin.goto(`${BASE}/fr/admin/customers?q=${stamp}`);
  await admin.getByRole("link", { name: customer.name }).click();
  await admin.getByRole("heading", { name: customer.name }).waitFor();
  await admin.getByText(/Terminée.*comptoir/).waitFor();
  await admin.goto(`${BASE}/fr/admin`);
  await admin.getByText("7 jours · comptoir").waitFor();

  // Customers cannot reach any of it.
  for (const path of ["/fr/admin/customers", "/fr/staff/counter"]) assert.equal((await shopper.goto(`${BASE}${path}`))?.status(), 404);
  console.log("admin complete smoke: ok");
} finally {
  await browser.close();
}
