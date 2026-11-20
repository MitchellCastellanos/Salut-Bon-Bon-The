import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import forge from "node-forge";
import jsQR from "jsqr";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";

const local = vi.hoisted(() => ({ current: undefined as PGlite | undefined }));
vi.mock("../src/db", async () => {
  local.current = new PGlite();
  await (await vi.importActual<typeof import("../src/db")>("../src/db")).applyLocalMigrations(local.current);
  return { database: async () => local.current };
});
import * as loyalty from "../src/loyalty";
import { applySimulatedPayment, recordCheckoutSession, simulatedAttempt } from "../src/payments";
import { RefundError, refundOrder } from "../src/refunds";
import { toggleFavorite, favoriteProducts } from "../src/favorites";
import { ensureIdentifier, identifierPattern, identifierUrl, lookupIdentifier, revokeIdentifier, rotateIdentifier } from "../src/identification";
import { brandedQr } from "../src/qr-logo";
import { buildPass, issuePass, passAuthToken, passJson, validAuthToken, walletConfig, zip } from "../src/wallet";
import { applyDemoSettings } from "../src/demo-setup";
import { notifyOrder } from "../src/notifications";

const q = async (sql: string, args: unknown[] = []) => (await local.current!.query<Record<string, unknown>>(sql, args)).rows;
beforeAll(() => { process.env.BETTER_AUTH_SECRET = "test-secret-test-secret-test-secret-0123"; });
afterAll(async () => local.current?.close());
beforeEach(() => vi.unstubAllEnvs());

let n = 0;
async function member() {
  n++;
  const id = randomUUID();
  await q(`INSERT INTO "user" ("id","name","email","role") VALUES ($1,'Léa Gagnon',$2,'CUSTOMER')`, [id, `p${n}@example.invalid`]);
  return { id, account: await loyalty.enroll(id, local.current as never) };
}
async function cardOrder(paymentMethod: "card" | "pickup" = "card", payment = "UNPAID") {
  n++;
  const [row] = await q(`INSERT INTO orders (request_id, request_fingerprint, tracking_token, locale, customer, notes, pickup_at, items, total, payment, tax_cents, payment_method)
    VALUES (gen_random_uuid(), 'f', $1, 'en', 'Test Guest', '', now() + interval '1 hour', '[{"name":{"fr":"Fraise","en":"Strawberry"},"quantity":2,"subtotal":1000}]', 1150, $2, 150, $3) RETURNING number::text AS number`,
    [String(n).padStart(64, "c"), payment, paymentMethod]);
  return row.number as string;
}

describe("simulated payment (stands in for Stripe in demo mode)", () => {
  it("settles through the same reconciliation, once, and never for a Stripe session", async () => {
    const number = await cardOrder();
    const session = `sim_cs_${"a".repeat(32)}`;
    await recordCheckoutSession({ order: number, sessionId: session, url: `/en/pay/${session}`, cents: 1150, provider: "simulated" });
    expect((await simulatedAttempt(session))?.order_number).toBe(number);
    expect(await applySimulatedPayment(session, "paid")).toEqual({ outcome: "paid", order: number, payment: "PAID_ONLINE" });
    expect(await applySimulatedPayment(session, "paid")).toEqual({ outcome: "replay" });
    expect((await q("SELECT payment FROM orders WHERE number = $1", [number]))[0].payment).toBe("PAID_ONLINE");
    expect(await simulatedAttempt("cs_test_real")).toBeUndefined();
    const other = await cardOrder();
    await recordCheckoutSession({ order: other, sessionId: "cs_test_stripe_1", url: "https://checkout.stripe.test", cents: 1150 });
    expect(await applySimulatedPayment("cs_test_stripe_1", "paid")).toEqual({ outcome: "ignored" });
  });
  it("cancels the order and releases the slot when the payment is abandoned", async () => {
    const number = await cardOrder();
    const session = `sim_cs_${"b".repeat(32)}`;
    await recordCheckoutSession({ order: number, sessionId: session, url: "x", cents: 1150, provider: "simulated" });
    expect((await applySimulatedPayment(session, "failed")).outcome).toBe("failed");
    expect((await q("SELECT status, payment FROM orders WHERE number = $1", [number]))[0]).toMatchObject({ status: "CANCELLED", payment: "PAYMENT_FAILED" });
  });
});

describe("email without a provider (demo)", () => {
  it("records the message as skipped and never queues it for later delivery", async () => {
    vi.stubEnv("SALUT_DEMO_MODE", "1"); vi.stubEnv("DATABASE_URL", "postgres://x");
    const number = await cardOrder();
    await notifyOrder(number, ["customer_confirmation", "store_notification"]);
    const rows = await q("SELECT kind, status, recipient FROM email_outbox WHERE order_number = $1 ORDER BY kind", [number]);
    expect(rows.map(r => r.status)).toEqual(["SKIPPED", "SKIPPED"]);
    expect(rows[0].recipient).toBe("(no address on file)");
  });
});

describe("stable member identification", () => {
  it("is opaque, resolves for staff, and stops resolving after rotation or revocation", async () => {
    const { account } = await member();
    const first = await ensureIdentifier(account.id, local.current as never);
    expect(identifierPattern.test(first.value)).toBe(true);
    expect(first.value).not.toContain(account.member_code);
    expect((await lookupIdentifier(first.value, local.current as never))?.accountId).toBe(account.id);
    expect((await lookupIdentifier(first.value.toLowerCase(), local.current as never))?.accountId).toBe(account.id);
    // A tampered value (same serial, wrong MAC) and garbage resolve to nothing.
    const tampered = first.value.slice(0, 21) + (first.value[21] === "A" ? "B" : "A");
    expect(await lookupIdentifier(tampered, local.current as never)).toBeUndefined();
    expect(await lookupIdentifier("short", local.current as never)).toBeUndefined();
    expect((await ensureIdentifier(account.id, local.current as never)).value).toBe(first.value);
    await rotateIdentifier(account.id, "admin", local.current as never);
    const second = await ensureIdentifier(account.id, local.current as never);
    expect(second.value).not.toBe(first.value);
    expect(await lookupIdentifier(first.value, local.current as never)).toBeUndefined();
    expect((await lookupIdentifier(second.value, local.current as never))?.accountId).toBe(account.id);
    await revokeIdentifier(account.id, "admin", local.current as never);
    expect(await lookupIdentifier(second.value, local.current as never)).toBeUndefined();
    expect((await q("SELECT action FROM catalog_audit_history WHERE action LIKE 'loyalty.identifier.%' ORDER BY id")).map(r => r.action)).toEqual(["loyalty.identifier.rotate", "loyalty.identifier.revoke"]);
  });
  it("has a short public URL", () => {
    expect(identifierUrl("A".repeat(22), "https://example.invalid/")).toBe(`https://example.invalid/s/${"A".repeat(22)}`);
  });
});

describe("redemption by identified member", () => {
  it("redeems the free drink at 9 stamps once per key, honours the ADMIN switch and the program gates", async () => {
    const { account } = await member();
    await q("UPDATE loyalty_program SET active=true, accrual_enabled=true, redemption_enabled=true, identifier_redemption=true WHERE id=1");
    await q("UPDATE loyalty_rewards SET available = true WHERE id='free-drink'");
    await loyalty.awardInStore({ accountId: account.id, drinks: 9, key: "seed-9-stamps", actor: "staff" }, local.current as never);
    const key = `redeem-${randomUUID()}`;
    const result = await loyalty.redeemForMember({ accountId: account.id, rewardId: "free-drink", key, actor: "staff" }, local.current as never);
    expect(result).toMatchObject({ duplicate: false, balance: 0 });
    expect((await loyalty.redeemForMember({ accountId: account.id, rewardId: "free-drink", key, actor: "staff" }, local.current as never)).duplicate).toBe(true);
    await expect(loyalty.redeemForMember({ accountId: account.id, rewardId: "free-drink", key: "again-1234", actor: "staff" }, local.current as never)).rejects.toMatchObject({ code: "INSUFFICIENT_POINTS" });
    await loyalty.awardInStore({ accountId: account.id, drinks: 9, key: "seed-9-more", actor: "staff" }, local.current as never);
    await q("UPDATE loyalty_program SET identifier_redemption=false WHERE id=1");
    await expect(loyalty.redeemForMember({ accountId: account.id, rewardId: "free-drink", key: "no-switch-1", actor: "staff" }, local.current as never)).rejects.toMatchObject({ code: "NOT_AUTHORIZED" });
    await q("UPDATE loyalty_program SET identifier_redemption=true, redemption_enabled=false WHERE id=1");
    await expect(loyalty.redeemForMember({ accountId: account.id, rewardId: "free-drink", key: "no-redeem-1", actor: "staff" }, local.current as never)).rejects.toMatchObject({ code: "REDEMPTION_DISABLED" });
  });
  it("has a free-drink ceiling at the middle price tier, editable by ADMIN", async () => {
    expect((await loyalty.loyaltyProgram(local.current as never)).freeDrinkMaxCents).toBe(799);
    await loyalty.saveProgramConfig({ active: true, minOrderCents: 0, categories: [], previewVisible: true, accrualEnabled: true, redemptionEnabled: true, commercialAuthorized: true, freeDrinkMaxCents: 899 }, "admin", { production: false }, local.current as never);
    expect((await loyalty.loyaltyProgram(local.current as never)).freeDrinkMaxCents).toBe(899);
    await expect(loyalty.saveProgramConfig({ active: true, minOrderCents: 0, categories: [], previewVisible: true, accrualEnabled: true, redemptionEnabled: true, commercialAuthorized: true, freeDrinkMaxCents: 5 }, "admin", { production: false }, local.current as never)).rejects.toBeTruthy();
  });
});

describe("refunds", () => {
  it("refunds a simulated card payment idempotently, never above what was paid, and takes stamps back", async () => {
    const number = await cardOrder("card", "PAID_ONLINE");
    const session = `sim_cs_${"c".repeat(32)}`;
    await recordCheckoutSession({ order: number, sessionId: session, url: "x", cents: 1150, provider: "simulated" });
    await q("UPDATE payment_attempts SET status='PAID' WHERE provider_session_id=$1", [session]);
    await q("UPDATE orders SET status='COMPLETED' WHERE number=$1", [number]);
    const { account } = await member();
    await q("UPDATE orders SET loyalty_account_id=$2 WHERE number=$1", [number, account.id]);
    await q("UPDATE loyalty_program SET active=true, accrual_enabled=true WHERE id=1");
    expect((await loyalty.earnForOrder(number, local.current as never)).awarded).toBe(2);
    const key = `refund-${randomUUID()}`;
    expect(await refundOrder({ order: number, amountCents: 575, reason: "customer changed mind", key, actor: "admin" }, local.current as never)).toMatchObject({ duplicate: false, full: false });
    expect(await refundOrder({ order: number, amountCents: 575, reason: "customer changed mind", key, actor: "admin" }, local.current as never)).toMatchObject({ duplicate: true });
    await expect(refundOrder({ order: number, amountCents: 700, reason: "too much", key: `refund-${randomUUID()}`, actor: "admin" }, local.current as never)).rejects.toBeInstanceOf(RefundError);
    expect(await refundOrder({ order: number, amountCents: 575, reason: "rest of the order", key: `refund-${randomUUID()}`, actor: "admin" }, local.current as never)).toMatchObject({ full: true });
    expect((await q("SELECT payment FROM orders WHERE number=$1", [number]))[0].payment).toBe("REFUNDED");
    expect((await q("SELECT balance FROM loyalty_accounts WHERE id=$1", [account.id]))[0].balance).toBe(0);
    expect((await q("SELECT count(*)::int AS n FROM catalog_audit_history WHERE action='order.refund'"))[0].n).toBe(2);
    await expect(refundOrder({ order: number, amountCents: 100, reason: "again", key: `refund-${randomUUID()}`, actor: "admin" }, local.current as never)).rejects.toMatchObject({ code: "NOT_REFUNDABLE" });
  });
  it("refuses unpaid orders and short reasons", async () => {
    const number = await cardOrder("pickup", "UNPAID");
    await expect(refundOrder({ order: number, amountCents: 100, reason: "no payment", key: "unpaid-key-1", actor: "admin" }, local.current as never)).rejects.toMatchObject({ code: "NOT_REFUNDABLE" });
    await expect(refundOrder({ order: number, amountCents: 100, reason: "x", key: "unpaid-key-2", actor: "admin" }, local.current as never)).rejects.toMatchObject({ code: "AMOUNT" });
  });
});

describe("favorites", () => {
  it("toggles a favorite for existing products only", async () => {
    await q("INSERT INTO catalog_categories VALUES ('fav-cat','Cat','Cat') ON CONFLICT DO NOTHING");
    await q("INSERT INTO catalog_products (id, category) VALUES ('fav-1','fav-cat') ON CONFLICT DO NOTHING");
    await q("INSERT INTO catalog_product_translations VALUES ('fav-1','fr','Favori'),('fav-1','en','Favorite') ON CONFLICT DO NOTHING");
    const { id } = await member();
    expect(await toggleFavorite(id, "fav-1", local.current as never)).toBe(true);
    expect((await favoriteProducts(id, local.current as never)).map(r => r.en)).toEqual(["Favorite"]);
    expect(await toggleFavorite(id, "fav-1", local.current as never)).toBe(false);
    expect(await toggleFavorite(id, "does-not-exist", local.current as never)).toBe(false);
  });
});

describe("demo settings", () => {
  it("opens the test store without inventing prices, and records an audit trail", async () => {
    await q("INSERT INTO catalog_categories VALUES ('demo-cat','D','D') ON CONFLICT DO NOTHING");
    await q("INSERT INTO catalog_products (id, category, available) VALUES ('demo-p','demo-cat', false) ON CONFLICT DO NOTHING");
    await q("INSERT INTO catalog_variants (product_id, id, fr, en, price_cents) VALUES ('demo-p','regular','R','R',599),('demo-p','large','L','L',null) ON CONFLICT DO NOTHING");
    await applyDemoSettings("admin", local.current as never);
    expect((await q("SELECT available FROM catalog_products WHERE id='demo-p'"))[0].available).toBe(true);
    expect(await q("SELECT approved, available, price_cents FROM catalog_variants WHERE product_id='demo-p' ORDER BY id")).toEqual([
      { approved: false, available: false, price_cents: null }, { approved: true, available: true, price_cents: 599 }]);
    const program = await loyalty.loyaltyProgram(local.current as never);
    expect(program).toMatchObject({ active: true, accrualEnabled: true, redemptionEnabled: true, commercialAuthorized: true });
    expect((await q("SELECT value FROM catalog_store_settings WHERE key='fiscal_settings'"))[0].value).toMatchObject({ status: "not_registered" });
    expect((await q("SELECT count(*)::int AS n FROM catalog_audit_history WHERE action LIKE 'demo.%'"))[0].n).toBeGreaterThanOrEqual(2);
  });
});

describe("card QR with the official logo", () => {
  const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1065 1477"><title>x</title><rect x="100" y="100" width="865" height="1277" fill="#2c0f08"/></svg>`;
  const payload = "https://salutbonbonthe.ca/s/ABCDEFGHJKLMNPQRSTUVWX";
  it("uses error correction H, a 4-module quiet zone and keeps the logo's aspect ratio", () => {
    const { svg, modules } = brandedQr(payload, { logoSvg: logo });
    expect(svg).toContain(`viewBox="0 0 ${modules + 8} ${modules + 8}"`);
    const box = svg.match(/<svg x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/)!;
    expect(Number(box[3]) / Number(box[4])).toBeCloseTo(1065 / 1477, 3);
    expect(svg).not.toContain("<title>x</title>");
  });
  it("still decodes with the logo at the configured size, at phone-like resolutions", async () => {
    const { svg } = brandedQr(payload, { logoSvg: logo });
    for (const width of [160, 240, 480]) {
      const { data, info } = await sharp(Buffer.from(svg), { density: 300 }).resize(width, width).flatten({ background: "#fff" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      expect(jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data).toBe(payload);
    }
  });
});

describe("Apple Wallet pass", () => {
  function testCredentials() {
    const make = (cn: string, issuer?: { key: forge.pki.rsa.PrivateKey; cert: forge.pki.Certificate }) => {
      const keys = forge.pki.rsa.generateKeyPair(1024);
      const cert = forge.pki.createCertificate();
      cert.publicKey = keys.publicKey; cert.serialNumber = "01";
      cert.validity.notBefore = new Date(Date.now() - 1000); cert.validity.notAfter = new Date(Date.now() + 86400000);
      cert.setSubject([{ name: "commonName", value: cn }]); cert.setIssuer(issuer ? issuer.cert.subject.attributes : [{ name: "commonName", value: cn }]);
      cert.sign(issuer?.key ?? keys.privateKey, forge.md.sha256.create());
      return { key: keys.privateKey, cert };
    };
    const ca = make("Test WWDR"), signer = make("Pass Type ID: test", ca);
    return { cert: forge.pki.certificateToPem(signer.cert), key: forge.pki.privateKeyToPem(signer.key), wwdr: forge.pki.certificateToPem(ca.cert) };
  }
  const env = (c: ReturnType<typeof testCredentials>) => ({ APPLE_PASS_TYPE_ID: "pass.test.salut", APPLE_TEAM_ID: "ABCDE12345", APPLE_PASS_CERT_PEM_B64: Buffer.from(c.cert).toString("base64"),
    APPLE_PASS_KEY_PEM_B64: Buffer.from(c.key).toString("base64"), APPLE_WWDR_PEM_B64: Buffer.from(c.wwdr).toString("base64"), SITE_URL: "https://salut.example.invalid", DATABASE_URL: "postgres://x", BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-0123" });

  it("is not configured without every credential", () => {
    expect(walletConfig({})).toBeUndefined();
    expect(walletConfig({ APPLE_PASS_TYPE_ID: "pass.x" })).toBeUndefined();
  });
  it("builds a ZIP with a SHA-1 manifest and a valid detached signature, and carries the stable QR (never the redemption URL)", async () => {
    const creds = testCredentials();
    const config = walletConfig(env(creds))!;
    expect(config).toBeTruthy();
    const { account } = await member();
    for (const [k, v] of Object.entries(env(creds))) vi.stubEnv(k, v);
    const pass = await issuePass(account.id, "en", local.current as never);
    const dir = mkdtempSync(join(tmpdir(), "pkpass-"));
    writeFileSync(join(dir, "p.pkpass"), pass);
    execFileSync("unzip", ["-q", join(dir, "p.pkpass"), "-d", join(dir, "x")]);
    const read = (name: string) => execFileSync("cat", [join(dir, "x", name)]);
    const manifest = JSON.parse(read("manifest.json").toString());
    for (const [name, sha] of Object.entries(manifest)) expect(createHash("sha1").update(read(name)).digest("hex")).toBe(sha);
    expect(Object.keys(manifest)).toEqual(expect.arrayContaining(["pass.json", "icon.png", "logo.png"]));
    writeFileSync(join(dir, "wwdr.pem"), creds.wwdr);
    expect(() => execFileSync("openssl", ["smime", "-verify", "-inform", "DER", "-in", join(dir, "x", "signature"), "-content", join(dir, "x", "manifest.json"), "-noverify", "-out", "/dev/null"], { stdio: "pipe" })).not.toThrow();
    const json = JSON.parse(read("pass.json").toString());
    const id = await ensureIdentifier(account.id, local.current as never);
    expect(json.barcodes[0]).toMatchObject({ format: "PKBarcodeFormatQR", message: identifierUrl(id.value, "https://salut.example.invalid") });
    expect(JSON.stringify({ ...json, authenticationToken: undefined })).not.toMatch(/staff\/rewards|[0-9a-f]{64}/); // no redemption URL or token in the pass
    expect(json.passTypeIdentifier).toBe("pass.test.salut");
    expect(json.barcodes[0].message).not.toContain(account.member_code); // the barcode never carries the member code or personal data
    // Update web service authentication accepts only the right token for that serial.
    const serial = json.serialNumber as string;
    expect(validAuthToken(serial, `ApplePass ${passAuthToken(serial)}`)).toBe(true);
    expect(validAuthToken(serial, "ApplePass nope")).toBe(false);
    expect(validAuthToken(serial, null)).toBe(false);
    expect(validAuthToken("0".repeat(32), `ApplePass ${passAuthToken(serial)}`)).toBe(false);
  });
  it("shows progress and voids when revoked", () => {
    const config = { passTypeId: "pass.test.salut", teamId: "ABCDE12345", site: "https://salut.example.invalid" };
    const base = { serial: "a".repeat(32), memberCode: "ABCD2345", barcodeUrl: "https://x/s/Y", name: "Léa Gagnon", lang: "en" as const, updatedAt: new Date() };
    expect(passJson({ ...base, balance: 3 }, config).storeCard.primaryFields[0].value).toBe("3 / 9");
    expect(passJson({ ...base, balance: 9 }, config).storeCard.secondaryFields[0].value).toBe("Ready!");
    expect(passJson({ ...base, balance: 3, voided: true }, config)).toMatchObject({ voided: true });
    expect(buildPass).toBeTypeOf("function");
  });
  it("writes a readable ZIP", () => {
    const data = zip([{ name: "a.txt", data: Buffer.from("hello") }]);
    const dir = mkdtempSync(join(tmpdir(), "zip-"));
    writeFileSync(join(dir, "z.zip"), data);
    expect(execFileSync("unzip", ["-p", join(dir, "z.zip"), "a.txt"]).toString()).toBe("hello");
  });
});
