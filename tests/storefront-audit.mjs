// Storefront image, campaign and accessibility audit against a running official-catalog app.
// Usage: SMOKE_BASE_URL=http://localhost:3101 CHROMIUM_PATH=… node tests/storefront-audit.mjs
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:3101";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ["--no-sandbox"] });
const step = name => console.log(`  ✓ ${name}`);
const campaigns = [
  { id: "fresh-mango-series", image: "drinks/hero.webp", products: 5, cta: { fr: "Découvrir la série", en: "Explore the series" } },
  { id: "creme-brulee", image: "promotions/creme-brulee.webp", products: 4, cta: { fr: "Voir la collection", en: "View the collection" } },
  { id: "house-lemonade", image: "promotions/house-lemonade.webp", products: 6, cta: { fr: "Voir la collection", en: "View the collection" } },
];
const pages = ["/fr", "/en", ...campaigns.flatMap(c => [`/fr/catalog/${c.id}`, `/en/catalog/${c.id}`]), "/fr/catalog", "/en/catalog", "/fr/catalog/products/MANGO-01", "/en/catalog/products/BRULEE-01", "/fr/account", "/en/account"];

async function load(page, path) {
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  await page.evaluate(async () => { for (const i of document.images) { i.scrollIntoView({ block: "center", inline: "center" }); await new Promise(r => setTimeout(r, 120)); } window.scrollTo(0, 0); });
  await page.waitForTimeout(300);
}
try {
  for (const [name, viewport, mobile] of [["desktop", { width: 1280, height: 900 }, false], ["mobile", { width: 390, height: 844 }, true]]) {
    const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
    const page = await ctx.newPage();
    const failed = [];
    page.on("response", r => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
    for (const path of pages) {
      await load(page, path);
      const r = await page.evaluate(() => {
        const unnamed = [...document.querySelectorAll("a[href],button")].filter(e => !(e.textContent || "").trim() && !e.getAttribute("aria-label") && !e.querySelector("img[alt]:not([alt=''])")).length;
        const unlabeled = [...document.querySelectorAll("input:not([type=hidden]),select,textarea")].filter(e => !e.labels?.length && !e.getAttribute("aria-label")).length;
        const ids = [...document.querySelectorAll("[id]")].map(e => e.id); 
        return {
          h1: document.querySelectorAll("h1").length, lang: document.documentElement.lang, noAlt: [...document.images].filter(i => !i.hasAttribute("alt")).length,
          broken: [...document.images].filter(i => !(i.complete && i.naturalWidth > 0)).map(i => i.currentSrc || i.src), unnamed, unlabeled,
          dupIds: ids.length - new Set(ids).size, overflow: document.documentElement.scrollWidth > innerWidth,
          text: document.body.innerText,
        };
      });
      const where = `${name} ${path}`;
      assert.deepEqual(r.broken, [], `${where}: broken images`);
      assert.equal(r.h1, 1, `${where}: exactly one h1 (found ${r.h1})`);
      assert.equal(r.noAlt, 0, `${where}: every image has an alt attribute`);
      assert.equal(r.unnamed, 0, `${where}: links and buttons have names`);
      assert.equal(r.unlabeled, 0, `${where}: form fields are labelled`);
      assert.equal(r.dupIds, 0, `${where}: no duplicate ids`);
      assert.equal(r.overflow, false, `${where}: no horizontal overflow`);
      assert.match(r.lang, path.startsWith("/en") ? /^en/ : /^fr/, `${where}: html lang`);
      assert.doesNotMatch(r.text, /Bientôt disponible|Coming soon|à venir|prochainement|Aperçu de démonstration|Demo preview|Menu démo|Demo menu/, `${where}: no placeholder or demo copy`);
    }
    assert.deepEqual(failed, [], `${name}: no failed requests`);
    step(`${name}: ${pages.length} pages — images load, one h1, alt/labels/names, no overflow, no placeholder copy`);

    // Hero carousel: every campaign slide shows its own image and links to a real collection.
    for (const lang of ["fr", "en"]) {
      await load(page, `/${lang}`);
      for (const [i, c] of campaigns.entries()) {
        if (i > 0) await page.getByRole("button", { name: lang === "fr" ? "Promotion suivante" : "Next promotion" }).click();
        await page.waitForTimeout(250);
        const slide = page.locator("#hero");
        await slide.locator(`img[src*="${encodeURIComponent("/" + c.image)}"], img[src*="${c.image.replace("/", "%2F")}"]`).first().waitFor();
        const link = slide.getByRole("link", { name: c.cta[lang] });
        assert.equal(await link.getAttribute("href"), `/${lang}/catalog/${c.id}`);
      }
    }
    step(`${name}: hero carousel shows Mango, Crème Brûlée and House Lemonade with correct images and links (FR + EN)`);

    // Campaign cards on the homepage and collection pages show the right images and real products.
    for (const lang of ["fr", "en"]) {
      await load(page, `/${lang}`);
      for (const c of campaigns) {
        const card = page.locator(`#promotions a[href="/${lang}/catalog/${c.id}"]`);
        assert.equal(await card.count(), 1, `${c.id} card`);
        assert.ok(await card.locator("img").count() === 1, `${c.id} card image`);
        assert.match(await card.locator("img").getAttribute("src"), new RegExp(encodeURIComponent("/" + c.image).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        await load(page, `/${lang}/catalog/${c.id}`);
        assert.equal(await page.locator(".catalog-grid li").count(), c.products, `${c.id} lists ${c.products} real products`);
        await load(page, `/${lang}`);
      }
    }
    step(`${name}: campaign cards and collection pages show correct imagery and the official products`);
    await ctx.close();
  }
  console.log("\nStorefront image, campaign and accessibility audit passed.");
} finally { await browser.close(); }
