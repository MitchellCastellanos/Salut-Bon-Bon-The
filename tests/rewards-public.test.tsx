// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Local in-memory PostgreSQL-compatible database (the embedded demo engine), so the real page code reads real configuration.
process.env.SALUT_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, redirect: () => { throw new Error("REDIRECT"); }, usePathname: () => "/" }));

const { database } = await import("../src/db");
const { RewardsPage, rewardsMetadata } = await import("../src/rewards-page");
const { rewardsPath, cardPath } = await import("../src/rewards-paths");

const html = async (lang: "fr" | "en") => renderToStaticMarkup(await RewardsPage({ lang }));
beforeAll(async () => {
  const db = await database();
  await db.query(`INSERT INTO "user" ("id","name","email","role") VALUES ('u-private','Marie Tremblay','marie.private@example.invalid','CUSTOMER')`);
  await db.query("INSERT INTO loyalty_accounts (user_id, member_code, balance) VALUES ('u-private','ZZZZ2222',4321)");
});
afterAll(async () => { await (await database() as unknown as { close(): Promise<void> }).close(); });

describe("public Salut Rewards page (no login, FR/EN)", () => {
  it("renders the French page with the 5 % terms, steps, calculator, reward states, FAQ and CTAs", async () => {
    const page = await html("fr");
    expect(page).toContain("Chaque gorgée");
    expect(page).toContain("5 %");
    expect(page).toContain("10 points par 1 $");
    for (const word of ["Commandez", "Cumulez", "Profitez"]) expect(page).toContain(word);
    expect(page).toContain('data-testid="calculator"');
    expect(page).toContain("5 $ de rabais");
    expect(page).toContain("Bientôt disponible");
    expect(page).toContain("Aperçu : pas encore actif");
    for (const q of ["Est-ce gratuit", "Ai-je besoin d’un compte", "Les points expirent-ils", "remboursement"]) expect(page).toContain(q);
    expect(page).toContain("Aucune politique d’expiration");
    expect(page).toContain('href="/fr/menu"'); // outside official-catalog mode the CTA points to the demo menu
    expect(page).toContain(cardPath.fr);
  });
  it("renders the English page with natural, consistent copy", async () => {
    const page = await html("en");
    expect(page).toContain("Every sip");
    expect(page).toContain("5%");
    for (const word of ["Order", "Earn", "Enjoy"]) expect(page).toContain(word);
    expect(page).toContain("$5 off");
    expect(page).toContain("Coming soon");
    expect(page).toContain("Do points expire?");
    expect(page).toContain(cardPath.en);
  });
  it("never presents an unavailable reward as redeemable and labels the preview", async () => {
    const page = await html("fr");
    expect(page).not.toContain("rw-state available");
    expect(page).toContain('data-testid="preview-note"');
  });
  it("contains no private data from accounts, members or orders", async () => {
    for (const lang of ["fr", "en"] as const) {
      const page = await html(lang);
      expect(page).not.toMatch(/Tremblay|marie\.private|ZZZZ2222|4321|u-private/);
    }
  });
  it("is hidden (404) when the ADMIN switches the public preview off", async () => {
    const db = await database();
    await db.query("UPDATE loyalty_program SET preview_visible = false");
    await expect(RewardsPage({ lang: "fr" })).rejects.toThrow("NOT_FOUND");
    expect(await rewardsMetadata("fr")).toMatchObject({ robots: { index: false } });
    await db.query("UPDATE loyalty_program SET preview_visible = true");
  });
  it("exposes localized metadata and the FR/EN alternates when the site URL is set", async () => {
    process.env.SITE_URL = "https://example.invalid";
    const fr = await rewardsMetadata("fr"); const en = await rewardsMetadata("en");
    delete process.env.SITE_URL;
    expect(fr.alternates).toEqual({ canonical: rewardsPath.fr, languages: { "fr-CA": "/fr/recompenses", "en-CA": "/en/rewards", "x-default": "/fr/recompenses" } });
    expect(en.alternates?.canonical).toBe("/en/rewards");
    expect(String(fr.description).replace(/\s/g, " ")).toContain("1 000 points = 5 $");
    expect(String(fr.description)).toContain("aperçu");
    expect(String(en.description)).toContain("1,000 points = $5 off");
  });
  it("states only what is implemented: counter redemption, no automatic online discount", async () => {
    const page = await html("en");
    expect(page).toContain("no discount is applied automatically to online orders");
  });
});
