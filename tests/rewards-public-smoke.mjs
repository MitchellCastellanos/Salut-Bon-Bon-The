// Public Salut Rewards page, guest card, counter flow and responsive checks (390 px and 1280 px, FR and EN).
// Run on the same disposable fixture as tests/rewards-browser-smoke.mjs (it needs ADMIN/STAFF accounts, the official
// catalog and, for the guest-order step, an open checkout). Env: E2E_DATABASE_URL, SMOKE_BASE_URL, CHROMIUM_PATH,
// optional SHOT_DIR for screenshots.
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import pg from "pg";
import { chromium } from "playwright-core";

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:3101";
const SHOTS = process.env.SHOT_DIR;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const db = new pg.Pool({ connectionString: process.env.E2E_DATABASE_URL, max: 3 });
const q = async (sql, args = []) => (await db.query(sql, args)).rows;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ["--no-sandbox"] });
const step = name => console.log(`  ✓ ${name}`);
const hash = t => createHash("sha256").update(t).digest("hex");
const sizes = [["mobile-390", { width: 390, height: 844 }, true], ["desktop-1280", { width: 1280, height: 900 }, false]];
const paths = { fr: "/fr/recompenses", en: "/en/rewards" };
const operate = on => q("UPDATE loyalty_program SET active=$1, accrual_enabled=true, redemption_enabled=true, earn_categories=NULL, min_order_cents=0, preview_visible=true WHERE id=1", [on]);

async function context(viewport = { width: 1100, height: 900 }, mobile = false) {
  const c = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
  const p = await c.newPage(); p.setDefaultTimeout(15000); return { c, p };
}
async function settle(page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => { for (const i of document.images) { i.scrollIntoView({ block: "center" }); await new Promise(r => setTimeout(r, 80)); } window.scrollTo(0, 0); });
  await page.waitForTimeout(250);
}

try {
  await q("UPDATE loyalty_rewards SET available = false WHERE id = 'free-drink'");
  await operate(false);

  // ───────── Public page: no login, both languages, both widths ─────────
  for (const [name, viewport, mobile] of sizes) {
    const { c, p } = await context(viewport, mobile);
    for (const lang of ["fr", "en"]) {
      const fr = lang === "fr";
      const response = await p.goto(BASE + paths[lang]);
      assert.equal(response.status(), 200); await settle(p);
      assert.equal(new URL(p.url()).pathname, paths[lang], "no redirect to a login page");
      assert.equal(await p.locator("h1").count(), 1, "one h1");
      assert.equal(await p.locator("html").getAttribute("lang"), fr ? "fr-CA" : "en-CA");
      const layout = await p.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        broken: [...document.images].filter(i => !i.complete || i.naturalWidth === 0).map(i => i.src),
        unnamed: [...document.querySelectorAll("a[href],button")].filter(e => !(e.textContent || "").trim() && !e.getAttribute("aria-label")).length,
        unlabeled: [...document.querySelectorAll("input")].filter(i => !i.labels?.length && !i.getAttribute("aria-label")).length,
      }));
      assert.ok(layout.overflow <= 0, `${name} ${lang}: horizontal overflow ${layout.overflow}px`);
      assert.deepEqual(layout.broken, [], `${name} ${lang}: broken images`);
      assert.equal(layout.unnamed, 0, "every link and button has a name"); assert.equal(layout.unlabeled, 0, "every input has a label");
      for (const id of ["how", "card", "rewards", "participate", "faq"]) assert.equal(await p.locator(`#${id}`).count(), 1, `section #${id}`);
      assert.equal(await p.locator(".rw-steps li").count(), 3);
      const text = await p.locator('[data-testid="rewards-page"]').innerText();
      assert.match(text, fr ? /9 boissons/ : /9 drinks/); assert.match(text, fr ? /10e/ : /10th/);
      assert.match(text, fr ? /Aperçu : pas encore actif/ : /Preview: not active yet/);
      assert.equal(await p.locator('[data-testid="status-pill"]').count(), 1);
      assert.equal(await p.locator('.rw-card[data-state="available"]').count(), 0, "no reward is redeemable while the program is a preview");
      assert.ok(await p.locator(".rw-card").count() >= 1); assert.doesNotMatch(text, /Bientôt disponible|Coming soon/);
      assert.equal(await p.locator("details").count(), 9, "nine FAQ entries");
      await p.locator("details summary").first().click();
      assert.equal(await p.locator("details").first().evaluate(d => d.open), true);
      // header link + language switch land on the counterpart localized path
      await p.locator(`header a[href="${paths[lang]}"]`).first().waitFor({ state: "attached" });
      const switchHref = await p.locator('header a[lang]').first().getAttribute("href");
      assert.equal(switchHref, paths[fr ? "en" : "fr"]);
      // stamp card: accessible progress bar with the illustrative 6 of 9
      const card = p.locator('[data-testid="stamp-progress"]');
      assert.equal(await card.locator('[role="progressbar"]').getAttribute("aria-valuenow"), "6");
      assert.equal(await card.locator('[role="progressbar"]').getAttribute("aria-valuemax"), "9");
      assert.match(await card.innerText(), fr ? /Encore 3 boissons et la prochaine est gratuite/ : /3 more drinks and your next one is free/);
      if (SHOTS) await p.screenshot({ path: `${SHOTS}/rewards-${lang}-${name}.png`, fullPage: true });
    }
    await c.close();
  }
  step("FR/EN public pages at 390 px and 1280 px: no login, no overflow, images load, 3 steps, stamp card, preview state, FAQ, header link, language switch");

  const anon = await context();
  assert.equal((await anon.p.goto(`${BASE}/fr/rewards`)).status(), 404);
  assert.equal((await anon.p.goto(`${BASE}/en/recompenses`)).status(), 404);
  await anon.p.goto(BASE + paths.fr);
  assert.equal(await anon.p.locator('link[rel="canonical"]').getAttribute("href"), `${BASE}/fr/recompenses`);
  const alternates = await anon.p.locator('link[rel="alternate"][hreflang]').evaluateAll(ls => Object.fromEntries(ls.map(l => [l.hreflang, l.href])));
  assert.deepEqual(alternates, { "fr-CA": `${BASE}/fr/recompenses`, "en-CA": `${BASE}/en/rewards`, "x-default": `${BASE}/fr/recompenses` });
  assert.ok((await anon.p.title()).includes("Récompenses Salut"));
  assert.match(await anon.p.locator('meta[name="description"]').getAttribute("content"), /aperçu/i);
  assert.equal(await anon.p.locator('script[type="application/ld+json"]').count(), 0, "no structured data claims on the rewards page");
  const robots = await (await anon.c.request.get(`${BASE}/robots.txt`)).text();
  assert.match(robots, /Disallow: \/fr\/recompenses\/carte/); assert.doesNotMatch(robots, /Disallow: \/fr\/recompenses\n/);
  const sitemap = await (await anon.c.request.get(`${BASE}/sitemap.xml`)).text();
  assert.ok(sitemap.includes("/fr/recompenses") && sitemap.includes("/en/rewards"));
  step("wrong-language slugs 404; canonical, hreflang alternates, localized metadata, sitemap and robots are correct");

  // ───────── Preview toggle and operational states ─────────
  await q("UPDATE loyalty_program SET preview_visible=false WHERE id=1");
  assert.equal((await anon.p.goto(BASE + paths.fr)).status(), 404);
  assert.equal(await (async () => { await anon.p.goto(`${BASE}/fr`); return anon.p.locator('header nav a[href="/fr/recompenses"]').count(); })(), 0, "hidden preview removes the header link");
  await q("UPDATE loyalty_program SET preview_visible=true WHERE id=1");
  await q("UPDATE loyalty_rewards SET available = true WHERE id = 'free-drink'"); await operate(true);
  await anon.p.goto(BASE + paths.fr); await settle(anon.p);
  assert.ok(await anon.p.locator('.rw-card[data-state="available"]').count() >= 1, "offered reward on an active program is available");
  assert.equal(await anon.p.locator('[data-testid="preview-note"]').count(), 0);
  assert.match(await anon.p.locator('[data-testid="status-pill"]').innerText(), /Programme actif/);
  await operate(false);
  await anon.p.reload(); assert.equal(await anon.p.locator('.rw-card[data-state="available"]').count(), 0, "inactive program never shows a redeemable reward even if the reward is offered");
  step("preview visibility switch, active vs preview states; an inactive program never shows a redeemable reward");

  // ───────── Homepage + menu integration ─────────
  await anon.p.goto(`${BASE}/fr`);
  const banner = anon.p.locator("#rewards");
  assert.equal(await banner.getByRole("link", { name: /Découvrir le programme/ }).getAttribute("href"), "/fr/recompenses");
  assert.match(await banner.innerText(), /9 boissons/);
  await anon.p.goto(`${BASE}/en`);
  assert.equal(await anon.p.locator("#rewards").getByRole("link", { name: /Discover the program/ }).getAttribute("href"), "/en/rewards");
  assert.equal(await anon.p.locator("footer a", { hasText: "Salut Rewards" }).getAttribute("href"), "/en/rewards");
  step("homepage banner and footer link to the dedicated page with the 9 + 1 terms");
  await anon.c.close();

  // ───────── Guest card (no account) ─────────
  const g = await context();
  await g.p.goto(`${BASE}/fr/recompenses/carte`);
  await g.p.getByRole("button", { name: "Obtenir ma carte" }).click();
  await g.p.locator(".qr svg").waitFor();
  const cookie = (await g.c.cookies()).find(x => x.name === "salut-guest-card");
  assert.ok(cookie && cookie.httpOnly && /^[0-9a-f]{64}$/.test(cookie.value), "httpOnly secret cookie");
  const cardAccount = (await q("SELECT id, user_id, member_code, guest_secret_hash FROM loyalty_accounts WHERE guest_secret_hash = $1", [hash(cookie.value)]))[0];
  assert.ok(cardAccount && cardAccount.user_id === null);
  assert.equal(JSON.stringify(await q("SELECT * FROM loyalty_accounts")).includes(cookie.value), false, "the secret itself is never stored");
  assert.equal(await g.p.evaluate(() => JSON.stringify({ ...localStorage })), "{}", "nothing is kept in local storage");
  await g.p.locator("summary", { hasText: "Code de secours" }).click();
  const backup = (await g.p.locator("details code").innerText()).trim();
  assert.equal(backup, cookie.value);
  step("guest card created without an account: hashed secret, httpOnly cookie, QR, backup code, no local storage");
  const other = await context();
  const restore = async code => {   // submit and wait for the server action round-trip before asserting on the page
    await other.p.locator('input[name="code"]').fill(code);
    await Promise.all([other.p.waitForResponse(r => r.request().method() === "POST"), other.p.getByRole("button", { name: "Restaurer ma carte" }).click()]);
    await other.p.waitForLoadState("networkidle");
  };
  await other.p.goto(`${BASE}/fr/recompenses/carte`);
  await restore("f".repeat(64));
  await other.p.getByText("Code de secours invalide").waitFor();
  await restore(cardAccount.member_code);
  await other.p.getByText("Code de secours invalide").waitFor();
  await restore(backup);
  await other.p.locator(".qr svg").waitFor();
  step("restore: wrong codes and the short member code are rejected; the real backup code restores the card");
  await other.c.close();

  // ───────── Counter: staff scans the guest card, awards, redeems ─────────
  await operate(true); await q("UPDATE loyalty_rewards SET available = true WHERE id = 'free-drink'");
  const token = randomBytes(32).toString("hex");
  await q("INSERT INTO loyalty_qr_tokens (account_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '5 minutes')", [cardAccount.id, hash(token)]);
  const s = await context();
  await s.p.goto(`${BASE}/en/staff`);
  await s.p.getByLabel("Email").fill("staff@example.invalid"); await s.p.getByLabel("Password").fill("StaffPassw0rd!x");
  await s.p.getByRole("button", { name: "Sign in" }).click(); await s.p.waitForLoadState("networkidle");
  await s.p.goto(`${BASE}/en/staff/rewards?t=${token}`);
  await s.p.getByRole("heading", { name: /Guest \(digital card\)/ }).waitFor();
  assert.doesNotMatch(await s.p.locator("body").innerText(), /@/, "no email on the staff screen");
  await s.p.locator('input[name="drinks"]').fill("9");
  await s.p.getByRole("button", { name: "Add stamps" }).click();
  await s.p.getByText(/Stamps added: 9/).waitFor();
  assert.equal((await q("SELECT balance FROM loyalty_accounts WHERE id=$1", [cardAccount.id]))[0].balance, 9);
  assert.equal(await s.p.locator('[data-testid="stamp-progress"]').getAttribute("data-filled"), "9");
  await s.p.locator("form", { hasText: "Free drink" }).getByRole("button", { name: /Confirm redemption/ }).click();
  await s.p.getByText(/Reward given/).waitFor();
  assert.equal((await q("SELECT balance FROM loyalty_accounts WHERE id=$1", [cardAccount.id]))[0].balance, 0);
  await s.p.goto(`${BASE}/en/staff/rewards?t=${token}`);
  await s.p.getByText(/Invalid or expired/).waitFor();
  step("STAFF scans a guest card: only 'Guest' shown, adds 9 stamps, redeems the free drink once, the code cannot be reused");
  await s.c.close();

  // ───────── Guest card online order, cart estimate, confirmed points ─────────
  await g.p.goto(`${BASE}/fr/catalog`); await settle(g.p);
  if (await g.p.locator("#order-201").count()) {
    await g.p.locator("#order-201").getByRole("button", { name: /Personnaliser/ }).click();
    await g.p.getByRole("button", { name: "Ajouter au panier" }).click();
    await g.p.locator(".cart-lines li").first().waitFor();
    const hint = await g.p.locator('[data-testid="points-estimate"]').innerText();
    assert.match(hint, /Cette commande rapportera \d+ tampons?/); assert.match(hint, /confirmés une fois la commande terminée/);
    await g.p.getByLabel("Nom pour la cueillette").fill("Invité");
    const options = await g.p.locator('select[name="pickup"] option:not([disabled])').evaluateAll(os => os.map(o => o.value));
    await g.p.locator('select[name="pickup"]').selectOption(options[3]);
    await g.p.getByRole("button", { name: "Passer la commande" }).click();
    await g.p.waitForURL(/\/fr\/track\//);
    const [order] = await q("SELECT number::text AS n, loyalty_account_id, customer_user_id, items FROM orders ORDER BY number DESC LIMIT 1");
    assert.equal(order.loyalty_account_id, cardAccount.id); assert.equal(order.customer_user_id, null);
    const subtotal = order.items.reduce((sum, i) => sum + i.subtotal, 0);
    const staff2 = await context();
    await staff2.p.goto(`${BASE}/en/staff`);
    await staff2.p.getByLabel("Email").fill("staff@example.invalid"); await staff2.p.getByLabel("Password").fill("StaffPassw0rd!x");
    await staff2.p.getByRole("button", { name: "Sign in" }).click(); await staff2.p.waitForLoadState("networkidle");
    for (const label of ["→ Confirmed", "→ Preparing", "→ Ready"]) { await staff2.p.getByRole("button", { name: label }).first().click(); await staff2.p.waitForLoadState("networkidle"); }
    await staff2.p.getByRole("button", { name: "Record payment" }).first().click();
    await staff2.p.getByRole("button", { name: "→ Completed" }).first().click();
    for (let i = 0; i < 40 && (await q("SELECT status FROM orders WHERE number = $1", [order.n]))[0].status !== "COMPLETED"; i++) await staff2.p.waitForTimeout(250);
    assert.equal((await q("SELECT status FROM orders WHERE number = $1", [order.n]))[0].status, "COMPLETED");
    for (let i = 0; i < 40 && (await q("SELECT balance FROM loyalty_accounts WHERE id=$1", [cardAccount.id]))[0].balance === 0; i++) await staff2.p.waitForTimeout(250);
    assert.equal((await q("SELECT balance FROM loyalty_accounts WHERE id=$1", [cardAccount.id]))[0].balance, Math.min(10, order.items.reduce((sum, i) => sum + i.quantity, 0)), "one stamp per drink, capped per order");
    await staff2.c.close();
    await g.p.goto(`${BASE}/fr/recompenses/carte`);
    await g.p.getByText(/Tampons gagnés · \+\d+ · #/).waitFor();
    const trackText = await (await g.c.request.get(`${BASE}/fr/track/${(await q("SELECT tracking_token FROM orders WHERE number=$1", [order.n]))[0].tracking_token}`)).text();
    assert.doesNotMatch(trackText, /Tampons gagnés|solde/i, "the private tracking link never shows loyalty balances");
    step(`guest card collects the online order (#${order.n}, subtotal ${subtotal} cents) and the cart shows an estimate, not confirmed stamps`);
    // anonymous cart: no promise of points
    const noCard = await context(); await noCard.p.goto(`${BASE}/fr/catalog`); await settle(noCard.p);
    await noCard.p.locator("#order-201").getByRole("button", { name: /Personnaliser/ }).click();
    await noCard.p.getByRole("button", { name: "Ajouter au panier" }).click();
    await noCard.p.locator(".cart-lines li").first().waitFor();
    assert.match(await noCard.p.locator('[data-testid="points-estimate"]').innerText(), /ne cumulera pas de tampons sans compte ni carte/);
    await noCard.c.close();
    step("a cart with neither account nor card promises no stamps and offers sign-in or a guest card");
  } else step("checkout is closed on this fixture: guest-order and cart-estimate steps skipped");
  await g.c.close();

  // ───────── Admin states panel (ADMIN only) ─────────
  const a = await context();
  await a.p.goto(`${BASE}/en/staff`);
  await a.p.getByLabel("Email").fill("admin@example.invalid"); await a.p.getByLabel("Password").fill("AdminPassw0rd!x");
  await a.p.getByRole("button", { name: "Sign in" }).click(); await a.p.waitForLoadState("networkidle");
  await a.p.goto(`${BASE}/en/admin/rewards`);
  const stages = await a.p.locator('[data-testid="stages"]').innerText();
  for (const label of ["Program configured", "Public preview visible", "Earning operational", "Redemption operational", "Commercial activation authorized"]) assert.ok(stages.includes(label));
  await a.p.locator('form[aria-labelledby="refund"]').waitFor();
  step("ADMIN console shows the five separate program states and the refund-reversal form");
  await a.c.close();
  await operate(false);
  console.log("Public rewards page, guest card and counter smoke passed.");
} finally { await browser.close(); await db.end(); }
