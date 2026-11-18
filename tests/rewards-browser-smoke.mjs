// End-to-end: admin configuration, customer accounts, ordering, staff fulfilment, loyalty and isolation.
// Needs a migrated database with the official catalog, ADMIN admin@example.invalid and STAFF staff@example.invalid,
// and a server started with SALUT_EMAIL_CAPTURE_DIR set. See docs/TESTING.md.
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { chromium } from "playwright-core";

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:3101";
const MAILS = process.env.E2E_MAIL_DIR;
const db = new pg.Pool({ connectionString: process.env.E2E_DATABASE_URL, max: 3 });
const q = async (sql, args = []) => (await db.query(sql, args)).rows;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ["--no-sandbox"] });
const step = name => console.log(`  ✓ ${name}`);
const tz = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" });
const inDays = n => tz.format(Date.now() + n * 86400000);
const ctx = async () => { const c = await browser.newContext({ viewport: { width: 1100, height: 900 } }); const p = await c.newPage(); p.setDefaultTimeout(15000); return p; };
const hash = t => createHash("sha256").update(t).digest("hex");

async function staffLogin(page, email, password) {
  await page.goto(`${BASE}/fr/staff`);
  await page.getByLabel("Courriel").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Connexion" }).click();
  await page.waitForLoadState("networkidle");
}
function mailLink(to, kind) {
  const files = readdirSync(MAILS).filter(f => f.startsWith(`${kind}-`)).sort().reverse();
  for (const f of files) {
    const mail = JSON.parse(readFileSync(join(MAILS, f), "utf8"));
    if (mail.to === to) return mail.text.match(/http\S+\/fr\/account\/(?:verify|reset)\?token=\S+/)[0];
  }
  throw new Error(`no ${kind} email for ${to}`);
}
async function register(page, name, email, password) {
  await page.goto(`${BASE}/fr/account`);
  const form = page.locator("form", { hasText: "Créer mon compte" });
  await form.getByLabel("Prénom et nom").fill(name);
  await form.getByLabel("Courriel").fill(email);
  await form.getByLabel(/Mot de passe/).fill(password);
  await form.getByRole("checkbox").check();
  await form.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByText("courriel de confirmation").waitFor();
}
async function verifyAndLogin(page, name, email, password) {
  await page.goto(mailLink(email, "verify"));
  await page.getByRole("button", { name: "Confirmer mon courriel" }).click();
  await page.getByText("Courriel confirmé").waitFor();
  const form = page.locator("form", { hasText: "Se connecter" });
  await form.getByLabel("Courriel").fill(email);
  await form.getByLabel("Mot de passe").fill(password);
  await form.getByRole("button", { name: "Se connecter" }).click();
  await page.getByRole("heading", { name: /Mon compte/ }).waitFor();
  await page.getByText(email).first().waitFor();
}

try {
  // ───────── Admin: prices, hours, rewards ─────────
  const admin = await ctx();
  await staffLogin(admin, "admin@example.invalid", "AdminPassw0rd!x");
  await admin.goto(`${BASE}/fr/admin/prices`);
  await admin.locator('input[name="price_201_regular"]').fill("6.75");
  await admin.locator('input[name="price_201_large"]').fill("7.75");
  await admin.locator('input[name="avail_201"]').check();
  await admin.getByRole("button", { name: "Enregistrer tous les prix" }).click();
  await admin.getByText("Cochez la confirmation").waitFor();
  step("price sheet refuses to save without the approval confirmation");
  await admin.locator('input[name="price_201_regular"]').fill("6.75");
  await admin.locator('input[name="price_201_large"]').fill("7.75");
  await admin.locator('input[name="avail_201"]').check();
  await admin.locator('input[name="confirm"]').check();
  await admin.getByRole("button", { name: "Enregistrer tous les prix" }).click();
  await admin.getByText("Prix enregistrés").waitFor();
  const priced = await q("SELECT id, price_cents, approved, available FROM catalog_variants WHERE product_id = '201' ORDER BY id");
  assert.deepEqual(priced.map(r => [r.id, r.price_cents, r.approved, r.available]), [["large", 775, true, true], ["regular", 675, true, true]]);
  assert.equal((await q("SELECT count(*)::int AS n FROM catalog_variants"))[0].n, 2, "blank prices must not create variants");
  step("price sheet saves approved prices and leaves blanks unpriced");

  await admin.goto(`${BASE}/fr/admin/hours`);
  for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
    await admin.locator(`input[name="${day}_open"]`).check();
    await admin.locator(`input[name="${day}_0_start"]`).fill("08:00");
    await admin.locator(`input[name="${day}_0_end"]`).fill("22:00");
  }
  await admin.locator('input[name="Mon_open"]').uncheck();
  await admin.locator('input[name="Mon_open"]').check();
  await admin.locator('input[name="Mon_0_start"]').fill("08:00");
  await admin.locator('input[name="Mon_0_end"]').fill("12:00");
  await admin.getByRole("button", { name: "+ Intervalle" }).first().click();
  await admin.locator('input[name="Mon_1_start"]').fill("13:00");
  await admin.locator('input[name="Mon_1_end"]').fill("22:00");
  assert.equal(await admin.locator(".hours-bar span").count() >= 8, true, "visual schedule draws a segment per interval");
  assert.equal(await admin.evaluate(() => { const e = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; }), true, "unsaved-changes warning");
  step("hours editor: toggles, multiple intervals, visual bar, unsaved-changes warning");
  await admin.locator('input[name="lead"]').fill("15");
  await admin.locator('input[name="capacity"]').fill("2");
  await admin.locator('input[name="advance"]').fill("7");
  await admin.locator('input[name="enabled"]').check();
  const closed = inDays(2);
  await admin.getByRole("button", { name: /Ajouter une fermeture/ }).click();
  await admin.locator('input[type="date"]').first().fill(closed);
  await admin.getByLabel("Motif (facultatif)").fill("Fermeture de test");
  await admin.getByRole("button", { name: /Enregistrer l.horaire/ }).click();
  await admin.getByText("Horaire enregistré").waitFor();
  const policy = (await q("SELECT value FROM catalog_store_settings WHERE key = 'pickup_policy'"))[0].value;
  assert.equal(policy.slotCapacity, 2); assert.equal(policy.taxRates, undefined, "tax no longer lives in the pickup policy");
  assert.equal(policy.exceptions[0].from, closed); assert.equal(policy.hours.Mon.length, 2);
  await admin.getByText("Fermeture de test").first().waitFor();
  step("business hours, pickup settings and a closure saved and previewed");

  await admin.goto(`${BASE}/fr/admin/hours`);
  await admin.locator('input[name="Tue_0_start"]').fill("23:00");
  await admin.locator('input[name="Tue_0_end"]').fill("22:00");
  await admin.getByRole("button", { name: /Enregistrer l.horaire/ }).click();
  await admin.getByRole("alert").first().waitFor();
  assert.equal((await q("SELECT value FROM catalog_store_settings WHERE key = 'pickup_policy'"))[0].value.hours.Tue[0][0], "08:00", "an invalid interval (start after end) must not be saved");
  step("invalid schedules are rejected server-side and the previous schedule is kept");

  // ───────── Business profile and fiscal settings ─────────
  await admin.goto(`${BASE}/fr/admin/hours`);
  await admin.getByText("La commande en ligne est fermée").waitFor();
  for (const text of ["statut fiscal", "profil du commerce"]) await admin.getByText(new RegExp(text, "i")).first().waitFor();
  const closedCatalog = await (await admin.request.get(`${BASE}/fr/catalog`)).text();
  assert.match(closedCatalog, /commande en ligne est indisponible/i, "checkout stays closed until the fiscal status and profile are set");
  step("checkout stays closed and the admin lists exactly what is missing (fiscal status, profile)");

  await admin.goto(`${BASE}/fr/admin/business`);
  const profileForm = admin.locator('form[aria-labelledby="profile"]');
  await profileForm.locator('input[name="displayName"]').fill("Salut Bon Bon Thé");
  await profileForm.locator('input[name="street"]').fill("1175 Rue Notre Dame");
  await profileForm.locator('input[name="city"]').fill("Lachine");
  await profileForm.locator('input[name="postalCode"]').fill("12345");
  await profileForm.locator('input[name="phone"]').fill("+1 514-637-6666");
  await profileForm.getByRole("button", { name: "Enregistrer le profil" }).click();
  await admin.getByText(/Code postal canadien invalide/).waitFor();
  // The failed save reloads the page with the (still empty) stored profile, so every required field is filled again.
  await profileForm.locator('input[name="displayName"]').fill("Salut Bon Bon Thé");
  await profileForm.locator('input[name="street"]').fill("1175 Rue Notre Dame");
  await profileForm.locator('input[name="city"]').fill("Lachine");
  await profileForm.locator('input[name="postalCode"]').fill("h8s2c5");
  await profileForm.locator('input[name="phone"]').fill("+1 514-637-6666");
  await profileForm.getByRole("button", { name: "Enregistrer le profil" }).click();
  await admin.waitForURL(/saved=profile/);
  assert.equal((await q("SELECT value->>'postalCode' AS p FROM catalog_store_settings WHERE key = 'business_profile'"))[0].p, "H8S 2C5");
  step("business profile: invalid postal code rejected server-side, valid profile saved and normalised");

  const fiscalForm = admin.locator('form[aria-labelledby="fiscal"]');
  await fiscalForm.locator('select[name="status"]').selectOption("registered");
  await fiscalForm.getByRole("button", { name: "Enregistrer les paramètres fiscaux" }).click();
  await admin.getByText(/dénomination sociale est obligatoire/).waitFor();
  await admin.locator('form[aria-labelledby="fiscal"] select[name="status"]').selectOption("registered");
  await admin.locator('form[aria-labelledby="fiscal"] input[name="legalName"]').fill("Test Shop Inc.");
  await admin.locator('form[aria-labelledby="fiscal"] input[name="gstNumber"]').fill("12345");
  await admin.locator('form[aria-labelledby="fiscal"]').getByRole("button", { name: "Enregistrer les paramètres fiscaux" }).click();
  await admin.getByText(/Numéro de TPS invalide/).waitFor();
  assert.equal(await q("SELECT 1 FROM catalog_store_settings WHERE key = 'fiscal_settings'").then(r => r.length), 0, "nothing saved while registration numbers are missing or invalid");
  step("fiscal settings: cannot register for tax without a legal name and valid GST/QST numbers (nothing is saved)");
  await admin.locator('form[aria-labelledby="fiscal"] select[name="status"]').selectOption("registered");
  await admin.locator('form[aria-labelledby="fiscal"] input[name="legalName"]').fill("Test Shop Inc.");
  await admin.locator('form[aria-labelledby="fiscal"] input[name="gstNumber"]').fill("123456789 rt 0001");
  await admin.locator('form[aria-labelledby="fiscal"] input[name="qstNumber"]').fill("1234567890 TQ 0001");
  await admin.locator('form[aria-labelledby="fiscal"]').getByRole("button", { name: "Enregistrer les paramètres fiscaux" }).click();
  await admin.waitForURL(/saved=fiscal/);
  const fiscalRow = (await q("SELECT value FROM catalog_store_settings WHERE key = 'fiscal_settings'"))[0].value;
  assert.equal(fiscalRow.gstNumber, "123456789 RT 0001"); assert.equal(fiscalRow.gstRate, 5000); assert.equal(fiscalRow.qstRate, 9975);
  step("fiscal settings saved (test-only registration numbers), GST 5% / QST 9.975% preserved");

  const home = await ctx();
  await home.goto(`${BASE}/fr`);
  await home.getByText("1175 Rue Notre Dame").first().waitFor();
  assert.ok(await home.getByRole("link", { name: "+1 514-637-6666" }).count() >= 1);
  assert.equal(await home.locator('script[type="application/ld+json"]').count(), 0, "no structured data until the owner confirms the details");
  await admin.goto(`${BASE}/fr/admin/business`);
  await admin.locator('form[aria-labelledby="profile"] input[name="confirmed"]').check();
  await admin.locator('form[aria-labelledby="profile"]').getByRole("button", { name: "Enregistrer le profil" }).click();
  await admin.waitForURL(/saved=profile/);
  await home.goto(`${BASE}/en`);
  const ld = JSON.parse(await home.locator('script[type="application/ld+json"]').first().textContent());
  assert.equal(ld.address.postalCode, "H8S 2C5"); assert.equal(ld.telephone, "+1 514-637-6666"); assert.equal(ld.email, undefined);
  assert.ok(ld.openingHoursSpecification.length >= 7, "structured data lists the persisted weekly hours");
  const footer = await home.locator("footer").innerText();
  assert.match(footer, /1175 Rue Notre Dame/); assert.match(footer, /\+1 514-637-6666/); assert.match(footer, /08:00/);
  step("storefront shows the persisted address, phone and hours in footer and Find-us; structured data appears only after owner confirmation");

  await admin.goto(`${BASE}/fr/admin/rewards`);
  const program = admin.locator('form[aria-labelledby="program"]');
  assert.equal(await program.locator('input[name="rate"]').inputValue(), "10", "the preview ships with 10 points per $1");
  await program.locator('input[name="rate"]').fill("");
  await program.locator('input[name="active"]').check();
  await program.getByRole("button", { name: "Enregistrer le programme" }).click();
  await admin.getByText("Définissez un taux").waitFor();
  step("program cannot be activated without an earning rate");
  await admin.locator('form[aria-labelledby="program"] input[name="active"]').check();
  await admin.locator('form[aria-labelledby="program"] input[name="rate"]').fill("2");
  await admin.locator('form[aria-labelledby="program"]').getByRole("button", { name: "Enregistrer le programme" }).click();
  await admin.waitForURL(/saved=program/);
  const reward = admin.locator("form", { hasText: "Nouvelle récompense" });
  await reward.locator('input[name="id"]').fill("free-drink");
  await reward.locator('input[name="nameFr"]').fill("Boisson gratuite");
  await reward.locator('input[name="nameEn"]').fill("Free drink");
  await reward.locator('input[name="cost"]').fill("10");
  await reward.locator('input[name="available"]').check();
  await reward.getByRole("button", { name: "Créer" }).click();
  await admin.waitForURL(/saved=reward/);
  assert.deepEqual((await q("SELECT active, points_per_dollar FROM loyalty_program"))[0], { active: true, points_per_dollar: 2 });
  assert.equal((await q("SELECT count(*)::int AS n FROM catalog_audit_history WHERE action LIKE 'loyalty.%'"))[0].n >= 2, true);
  step("rewards program activated by ADMIN, reward created, changes audited");

  // ───────── Customer A: registration → verification → rewards ─────────
  const ana = await ctx();
  await register(ana, "Ana Tremblay", "ana@example.invalid", "AnaSecretPass12");
  await ana.goto(`${BASE}/fr/account`);
  const early = ana.locator("form", { hasText: "Se connecter" });
  await early.getByLabel("Courriel").fill("ana@example.invalid");
  await early.getByLabel("Mot de passe").fill("AnaSecretPass12");
  await early.getByRole("button", { name: "Se connecter" }).click();
  await ana.getByText(/courriel non confirmé/).waitFor();
  step("login is refused until the email is confirmed");
  await verifyAndLogin(ana, "Ana Tremblay", "ana@example.invalid", "AnaSecretPass12");
  assert.equal((await q(`SELECT role FROM "user" WHERE email = 'ana@example.invalid'`))[0].role, "CUSTOMER");
  await ana.getByRole("button", { name: "Adhérer à Récompenses Salut" }).click();
  await ana.getByRole("heading", { name: "Récompenses Salut" }).first().waitFor();
  await ana.locator(".qr svg").waitFor();
  const code = (await ana.locator(".member-code").textContent()).trim();
  assert.match(code, /^[A-Z2-9]{8}$/);
  const qrTokens = await q("SELECT token_hash FROM loyalty_qr_tokens");
  assert.equal(qrTokens.length, 1); assert.match(qrTokens[0].token_hash, /^[0-9a-f]{64}$/);
  await ana.getByText("Boisson gratuite").waitFor();
  step("customer registered, verified, signed in, enrolled; QR card and rewards shown");
  await ana.getByRole("link", { name: "English" }).click();
  await ana.getByRole("heading", { name: "Salut Rewards" }).first().waitFor();
  await ana.getByText("Available rewards").waitFor();
  assert.equal(await ana.locator("html").getAttribute("lang"), "en-CA");
  step("rewards dashboard is bilingual");

  // ───────── Menu audit ─────────
  const guest = await ctx();
  await guest.goto(`${BASE}/fr`);
  const links = new Set();
  for (const lang of ["fr", "en"]) {
    await guest.goto(`${BASE}/${lang}`);
    for (const href of await guest.locator("a[href]").evaluateAll(as => as.map(a => a.getAttribute("href")))) {
      if (href && href.startsWith("/") && !href.startsWith("//")) links.add(href.split("#")[0] || `/${lang}`);
    }
  }
  let checked = 0;
  for (const href of links) { const r = await guest.request.get(BASE + href); assert.ok(r.status() < 400, `${href} -> ${r.status()}`); checked++; }
  await guest.goto(`${BASE}/fr`);
  assert.equal(await guest.locator(".category-tile").count(), 7, "seven category tiles");
  for (const href of await guest.locator(".category-tile").evaluateAll(as => as.map(a => a.getAttribute("href")))) {
    assert.ok((await guest.request.get(BASE + href)).status() < 400, `tile ${href}`);
  }
  const ids = (await q("SELECT id FROM catalog_products ORDER BY id")).map(r => r.id);
  assert.equal(ids.length, 62);
  for (const id of ids) for (const lang of ["fr", "en"]) assert.equal((await guest.request.get(`${BASE}/${lang}/catalog/products/${id}`)).status(), 200, `${lang} ${id}`);
  const html = await (await guest.request.get(`${BASE}/fr`)).text() + await (await guest.request.get(`${BASE}/fr/catalog`)).text() + await (await guest.request.get(`${BASE}/en/account`)).text();
  assert.doesNotMatch(html, /Bientôt disponible|Coming soon|coming soon|à venir|prochainement/);
  step(`menu audit: ${checked} homepage/nav links, 7 category tiles, 62×2 product pages, no placeholder text`);

  // ───────── Ordering as Ana (product customization, cart, checkout) ─────────
  await ana.goto(`${BASE}/fr/catalog`);
  await ana.waitForLoadState("networkidle");
  await ana.locator("#order-201").getByRole("button", { name: /Personnaliser/ }).click();
  await ana.getByLabel("Quantité").fill("2");
  await ana.getByRole("button", { name: "Ajouter au panier" }).click();
  await ana.locator(".cart-lines li").first().waitFor();
  await ana.getByRole("button", { name: /Augmenter la quantité/ }).click();
  await ana.locator(".qty output").first().getByText("3").waitFor();
  await ana.getByRole("button", { name: /Diminuer la quantité/ }).click();
  await ana.locator(".qty output").first().getByText("2").waitFor();
  await ana.locator("#order-201").getByRole("button", { name: /Personnaliser/ }).click();
  await ana.getByLabel("Format").selectOption("large");
  await ana.getByRole("button", { name: "Ajouter au panier" }).click();
  assert.equal(await ana.locator(".cart-lines li").count(), 2);
  await ana.getByRole("button", { name: /^Retirer/ }).last().click();
  assert.equal(await ana.locator(".cart-lines li").count(), 1);
  step("product customization, add to cart, quantity − / +, remove from cart");
  await ana.getByLabel("Nom pour la cueillette").fill("Ana");
  const options = await ana.locator('select[name="pickup"] option:not([disabled])').evaluateAll(os => os.map(o => o.value));
  assert.ok(options.length > 10, "pickup slots are offered");
  assert.ok(options.every(v => tz.format(Date.parse(v)) !== closed), "no slot on the closure date");
  assert.ok(options.every(v => { const h = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", hour: "2-digit", hourCycle: "h23" }).format(Date.parse(v))); return h >= 8 && h < 22; }), "slots stay within opening hours");
  await ana.locator('select[name="pickup"]').selectOption(options[3]);
  await ana.getByRole("button", { name: "Passer la commande" }).click();
  await ana.waitForURL(/\/fr\/track\//);
  const [order] = await q("SELECT number::text AS n, customer_user_id, customer_email, tax_cents, total, items FROM orders ORDER BY number DESC LIMIT 1");
  assert.equal(order.customer_email, "ana@example.invalid"); assert.ok(order.customer_user_id);
  const subtotal = order.items.reduce((s, i) => s + i.subtotal, 0);
  assert.equal(order.tax_cents, Math.round(subtotal * 0.05) + Math.round(subtotal * 0.09975)); assert.equal(subtotal, 1350);
  await ana.getByText("Cueillette en magasin").first().waitFor().catch(() => {});
  step("pickup checkout: server pricing, tax, customer link; slots respect hours and the closure");
  const [tracked] = await q("SELECT tracking_token, tax_breakdown, business_snapshot FROM orders WHERE number = $1", [order.n]);
  assert.deepEqual(tracked.tax_breakdown.map(l => l.code), ["GST", "QST"]);
  assert.equal(tracked.business_snapshot.gstNumber, "123456789 RT 0001");
  await ana.goto(`${BASE}/fr/track/${tracked.tracking_token}`);
  await ana.getByText("1175 Rue Notre Dame").first().waitFor();
  await ana.getByRole("link", { name: "Voir le reçu" }).click();
  await ana.getByRole("heading", { name: "Reçu" }).waitFor();
  const receiptText = await ana.locator(".receipt").innerText();
  for (const expected of ["Salut Bon Bon Thé", "Test Shop Inc.", "1175 Rue Notre Dame", "H8S 2C5", `Facture n° ${order.n}`, "Sous-total avant taxes", "TPS (5 %)", "123456789 RT 0001", "TVQ (9.975 %)", "1234567890 TQ 0001", "Total"]) {
    assert.ok(receiptText.includes(expected), `receipt shows: ${expected}`);
  }
  await admin.goto(`${BASE}/fr/admin/business`);
  await admin.locator('form[aria-labelledby="fiscal"] input[name="legalName"]').fill("Renamed Inc.");
  await admin.locator('form[aria-labelledby="fiscal"]').getByRole("button", { name: "Enregistrer les paramètres fiscaux" }).click();
  await admin.waitForURL(/saved=fiscal/);
  await ana.goto(`${BASE}/fr/track/${tracked.tracking_token}/receipt`);
  assert.ok((await ana.locator(".receipt").innerText()).includes("Test Shop Inc."), "a past receipt keeps the details it was issued with");
  step("receipt: establishment, bill number, itemised lines, GST and QST with registration numbers; unchanged by later edits");

  // ───────── Staff fulfils; loyalty earns on completion ─────────
  const staff = await ctx();
  await staffLogin(staff, "staff@example.invalid", "StaffPassw0rd!x");
  for (const label of ["→ Confirmée", "→ En préparation", "→ Prête"]) { await staff.getByRole("button", { name: label }).click(); await staff.waitForLoadState("networkidle"); }
  await staff.getByRole("button", { name: "Confirmer le paiement" }).click();
  await staff.getByRole("button", { name: "→ Terminée" }).click();
  for (let i = 0; i < 40 && (await q("SELECT status FROM orders WHERE number = $1", [order.n]))[0].status !== "COMPLETED"; i++) await staff.waitForTimeout(250);
  assert.equal((await q("SELECT status FROM orders WHERE number = $1", [order.n]))[0].status, "COMPLETED");
  const acct = (await q(`SELECT a.id, a.balance FROM loyalty_accounts a JOIN "user" u ON u.id = a.user_id WHERE u.email = 'ana@example.invalid'`))[0];
  assert.equal(acct.balance, 27, "floor(1350 cents × 2 points per dollar / 100)");
  await ana.goto(`${BASE}/fr/account/rewards`);
  await ana.getByText("27 points").first().waitFor();
  await ana.getByText("Points gagnés").waitFor();
  await ana.locator(".qr svg").waitFor();            // her page requests a fresh QR after load, which supersedes older tokens
  await ana.waitForLoadState("networkidle");
  step("completed order earned 27 points; shown in the customer's history");

  // ───────── QR identification and redemption at the counter ─────────
  const token = randomBytes(32).toString("hex");
  await q("INSERT INTO loyalty_qr_tokens (account_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '5 minutes')", [acct.id, hash(token)]);
  await staff.goto(`${BASE}/fr/staff/rewards?t=${token}`);
  await staff.getByRole("heading", { name: /Ana · / }).waitFor().catch(async error => { throw new Error(`${error.message}\nPAGE: ${(await staff.locator("main").innerText()).slice(0, 200)}\nTOKENS: ${JSON.stringify(await q("SELECT left(token_hash,8) h, expires_at, now() AS now, redeemed_at FROM loyalty_qr_tokens ORDER BY id"))}\nWANT: ${hash(token).slice(0, 8)}`); });
  assert.equal(await staff.getByText("Tremblay").count(), 0, "staff see the first name only");
  await staff.getByText("27 points").first().waitFor();
  await staff.getByRole("button", { name: "Confirmer l’échange" }).click();
  await staff.getByText("Récompense remise").waitFor();
  await staff.getByText("nouveau solde 17").waitFor();
  await staff.goto(`${BASE}/fr/staff/rewards?t=${token}`);
  assert.equal(await staff.getByRole("heading", { name: /Ana · / }).count(), 0, "a redeemed QR no longer identifies");
  assert.equal((await q("SELECT balance FROM loyalty_accounts WHERE id = $1", [acct.id]))[0].balance, 17);
  const token2 = randomBytes(32).toString("hex");
  await q("INSERT INTO loyalty_qr_tokens (account_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '5 minutes')", [acct.id, hash(token2)]);
  await staff.goto(`${BASE}/fr/staff/rewards?t=${token2}`);
  await staff.getByLabel(/Montant avant taxes/).fill("5.00");
  await staff.getByRole("button", { name: "Attribuer" }).click();
  await staff.getByText("Points attribués: 10").waitFor();
  assert.equal((await q("SELECT balance FROM loyalty_accounts WHERE id = $1", [acct.id]))[0].balance, 27);
  const expiredToken = randomBytes(32).toString("hex");
  await q("INSERT INTO loyalty_qr_tokens (account_id, token_hash, expires_at) VALUES ($1, $2, now() - interval '1 minute')", [acct.id, hash(expiredToken)]);
  await staff.goto(`${BASE}/fr/staff/rewards?t=${expiredToken}`);
  assert.equal(await staff.getByRole("heading", { name: /Ana · / }).count(), 0, "expired QR is rejected");
  step("staff QR flow: identify (first name only), redeem once, replay rejected, in-store award, expiry");

  // ───────── Admin sees history; customer adjustments need a reason ─────────
  await admin.goto(`${BASE}/fr/admin/rewards?q=${encodeURIComponent("ana@example.invalid")}`);
  await admin.getByText(/Ana Tremblay/).first().waitFor();
  const adj = admin.locator("form", { hasText: "Ajuster" }).first();
  await adj.getByLabel(/Points/).fill("-5");
  await adj.getByLabel(/Motif/).fill("Correction de test");
  await adj.getByRole("button", { name: "Ajuster" }).click();
  await admin.waitForURL(/saved=adjust/);
  assert.equal((await q("SELECT balance FROM loyalty_accounts WHERE id = $1", [acct.id]))[0].balance, 22);
  assert.equal((await q("SELECT count(*)::int AS n FROM loyalty_transactions WHERE kind = 'adjust' AND reason = 'Correction de test'"))[0].n, 1);
  step("ADMIN customer lookup, history and audited adjustment with reason");

  // ───────── Isolation and permissions ─────────
  const ben = await ctx();
  await register(ben, "Ben Roy", "ben@example.invalid", "BenSecretPass12");
  await verifyAndLogin(ben, "Ben Roy", "ben@example.invalid", "BenSecretPass12");
  assert.equal(await ben.getByText(/#\d+/).count(), 0, "Ben sees none of Ana's orders");
  await ben.getByRole("button", { name: "Adhérer à Récompenses Salut" }).click();
  await ben.locator(".member-code").waitFor();
  await ben.getByText("0 points").first().waitFor();
  assert.notEqual((await ben.locator(".member-code").textContent()).trim(), code);
  for (const path of ["/fr/admin", "/fr/admin/rewards", "/fr/admin/hours", "/fr/admin/prices"]) {
    assert.equal((await ben.request.get(BASE + path)).status(), 404, `customer must not reach ${path}`);
  }
  await ben.goto(`${BASE}/fr/staff/rewards?t=${token2}`);
  await ben.getByText("Connectez-vous à l’espace équipe").waitFor();
  const asStaffLogin = await ctx();
  await staffLogin(asStaffLogin, "ben@example.invalid", "BenSecretPass12");
  await asStaffLogin.getByText("Connexion refusée").waitFor();
  const staffRewardsAsStaff = await staff.request.get(`${BASE}/fr/admin/rewards`);
  assert.equal(staffRewardsAsStaff.status(), 404, "STAFF cannot use ADMIN pages");
  const customerOnAccount = await ctx();
  await staffLogin(customerOnAccount, "staff@example.invalid", "StaffPassw0rd!x");
  await customerOnAccount.goto(`${BASE}/fr/account`);
  await customerOnAccount.getByRole("button", { name: "Se connecter" }).waitFor();
  step("isolation: customers cannot reach staff/admin; staff are not customers; STAFF cannot use ADMIN pages");

  // ───────── Password reset ─────────
  const forgot = await ctx();
  await forgot.goto(`${BASE}/fr/account`);
  await forgot.getByText("Mot de passe oublié").click();
  await forgot.locator("details form").getByLabel("Courriel").fill("ben@example.invalid");
  await forgot.getByRole("button", { name: "Envoyer le lien" }).click();
  await forgot.getByText("un courriel de réinitialisation a été envoyé").waitFor();
  await forgot.goto(mailLink("ben@example.invalid", "reset"));
  await forgot.getByLabel("Nouveau mot de passe").fill("BenNewSecret1234");
  await forgot.getByRole("button", { name: "Enregistrer" }).click();
  await forgot.getByText("Mot de passe mis à jour").waitFor();
  const relog = forgot.locator("form", { hasText: "Se connecter" });
  await relog.getByLabel("Courriel").fill("ben@example.invalid");
  await relog.getByLabel("Mot de passe").fill("BenNewSecret1234");
  await relog.getByRole("button", { name: "Se connecter" }).click();
  await forgot.getByRole("heading", { name: /Mon compte/ }).waitFor();
  step("password reset by email");
  console.log("\nRewards, accounts, hours and menu browser smoke passed.");
} finally {
  await browser.close();
  await db.end();
}
