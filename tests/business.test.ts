import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { addressLine, businessSnapshot, computeTax, directionsHref, fiscalSchema, phoneHref, profileSchema, unconfiguredFiscal } from "../src/business-core";
import { businessJsonLd } from "../src/business-view";
import { buildStatements } from "../scripts/init-business.mjs";

const local = vi.hoisted(() => ({ current: undefined as PGlite | undefined }));
vi.mock("../src/db", async () => {
  local.current = new PGlite();
  await (await vi.importActual<typeof import("../src/db")>("../src/db")).applyLocalMigrations(local.current);
  return { database: async () => local.current };
});
beforeAll(async () => { await import("../src/db"); });
afterAll(async () => local.current?.close());
const q = async (sql: string, args: unknown[] = []) => (await local.current!.query<Record<string, unknown>>(sql, args)).rows;

const profile = { displayName: "Salut Bon Bon Thé", street: "1175 Rue Notre Dame", city: "Lachine", province: "Québec", postalCode: "h8s2c5", country: "Canada", phone: "+1 514-637-6666" };
const registered = { status: "registered", legalName: "Test Inc.", gstNumber: "123456789 RT 0001", qstNumber: "1234567890 TQ 0001" };

describe("business profile", () => {
  it("normalises Canadian postal codes and rejects invalid contact details", () => {
    expect(profileSchema.parse(profile).postalCode).toBe("H8S 2C5");
    expect(profileSchema.safeParse({ ...profile, postalCode: "12345" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...profile, postalCode: "D8S 2C5" }).success).toBe(false); // D is never a first letter
    expect(profileSchema.safeParse({ ...profile, phone: "call me" }).success).toBe(false);
    expect(profileSchema.parse(profile).verification.status).toBe("unverified");
    const p = profileSchema.parse(profile);
    expect(phoneHref(p.phone)).toBe("tel:+15146376666");
    expect(addressLine(p)).toBe("1175 Rue Notre Dame, Lachine (Québec) H8S 2C5");
    expect(directionsHref(p)).toContain(encodeURIComponent("1175 Rue Notre Dame"));
  });
  it("publishes structured data only after the owner confirms the details, with no invented fields", () => {
    const unverified = profileSchema.parse(profile);
    expect(businessJsonLd(unverified, null, "https://example.invalid")).toBeNull();
    const verified = profileSchema.parse({ ...profile, verification: { status: "verified" } });
    const json = JSON.parse(businessJsonLd(verified, { hours: { Mon: [["10:30", "20:00"]] } }, "https://example.invalid")!);
    expect(json).toMatchObject({ "@type": "FoodEstablishment", name: "Salut Bon Bon Thé", telephone: "+1 514-637-6666", address: { postalCode: "H8S 2C5", addressLocality: "Lachine" } });
    expect(json.openingHoursSpecification).toEqual([{ "@type": "OpeningHoursSpecification", dayOfWeek: "Monday", opens: "10:30", closes: "20:00" }]);
    expect(json.email).toBeUndefined(); expect(json.sameAs).toBeUndefined();
    expect(businessJsonLd(verified, null, undefined)).not.toContain("<");
  });
});

describe("fiscal settings and Québec tax", () => {
  it("never collects tax or accepts registration without valid numbers", () => {
    expect(unconfiguredFiscal.status).toBe("unconfigured");
    expect(fiscalSchema.safeParse({ status: "registered" }).success).toBe(false);
    expect(fiscalSchema.safeParse({ ...registered, qstNumber: undefined }).success).toBe(false);
    expect(fiscalSchema.safeParse({ ...registered, gstNumber: "12345" }).success).toBe(false);
    expect(fiscalSchema.safeParse({ ...registered, legalName: undefined }).success).toBe(false);
    expect(fiscalSchema.safeParse(registered).success).toBe(true);
    expect(fiscalSchema.safeParse({ status: "not_registered" }).success).toBe(true);
    expect(fiscalSchema.parse({}).gstRate).toBe(5000); expect(fiscalSchema.parse({}).qstRate).toBe(9975);
  });
  it("computes GST 5% and QST 9.975% separately on the pre-tax subtotal, rounded to the cent", () => {
    const f = fiscalSchema.parse(registered);
    expect(computeTax(1000, f)).toEqual({ cents: 150, lines: [{ code: "GST", rate: 5000, cents: 50 }, { code: "QST", rate: 9975, cents: 100 }] });
    expect(computeTax(1350, f).cents).toBe(68 + 135);
    expect(computeTax(675, f).lines.map(l => l.cents)).toEqual([34, 67]);
  });
  it("collects nothing unless registered", () => {
    expect(computeTax(1000, unconfiguredFiscal)).toEqual({ cents: 0, lines: [] });
    expect(computeTax(1000, fiscalSchema.parse({ status: "not_registered" }))).toEqual({ cents: 0, lines: [] });
  });
  it("snapshots registration numbers only when registered", () => {
    const p = profileSchema.parse(profile);
    expect(businessSnapshot(p, fiscalSchema.parse(registered))).toMatchObject({ gstNumber: "123456789 RT 0001", qstNumber: "1234567890 TQ 0001", taxStatus: "registered" });
    expect(businessSnapshot(p, fiscalSchema.parse({ status: "not_registered", gstNumber: "123456789 RT 0001" })).gstNumber).toBeUndefined();
  });
});

describe("checkout blockers", () => {
  beforeEach(async () => { await q("DELETE FROM catalog_store_settings"); await q("DELETE FROM catalog_variants"); await q("UPDATE catalog_products SET available = false"); });
  const policy = { hours: { Mon: [["10:30", "20:00"]] } };
  it("reports exactly what is missing and opens only when everything is valid", async () => {
    const { pickupConfiguration } = await import("../src/store-settings");
    expect((await pickupConfiguration()).blockers).toEqual(["FLAG_OFF", "NO_SCHEDULE", "NO_FISCAL_STATUS", "NO_PROFILE", "NO_PRICES"]);
    await q("INSERT INTO catalog_store_settings VALUES ('pickup_policy', $1::jsonb)", [JSON.stringify(policy)]);
    expect((await pickupConfiguration()).blockers).toEqual(["FLAG_OFF", "NO_LEAD_TIME", "NO_CAPACITY", "NO_FISCAL_STATUS", "NO_PROFILE", "NO_PRICES"]);
    await q("UPDATE catalog_store_settings SET value = $1::jsonb WHERE key = 'pickup_policy'", [JSON.stringify({ ...policy, leadMinutes: 20, slotCapacity: 3 })]);
    await q("INSERT INTO catalog_store_settings VALUES ('pickup_checkout_enabled', 'true'), ('business_profile', $1::jsonb), ('fiscal_settings', $2::jsonb)", [JSON.stringify(profileSchema.parse(profile)), JSON.stringify(fiscalSchema.parse({ status: "not_registered" }))]);
    expect((await pickupConfiguration()).blockers).toEqual(["NO_PRICES"]);
    await q("INSERT INTO catalog_categories VALUES ('c','C','C') ON CONFLICT DO NOTHING");
    await q("INSERT INTO catalog_products (id, category, available) VALUES ('p1','c',true) ON CONFLICT (id) DO UPDATE SET available = true");
    await q("INSERT INTO catalog_variants (product_id, id, fr, en, price_cents, approved, available) VALUES ('p1','regular','R','R',500,true,true)");
    const open = await pickupConfiguration();
    expect(open.blockers).toEqual([]); expect(open.enabled).toBe(true); expect(open.taxRates).toEqual([]);
    await q("UPDATE catalog_store_settings SET value = $1::jsonb WHERE key = 'fiscal_settings'", [JSON.stringify(fiscalSchema.parse(registered))]);
    expect((await pickupConfiguration()).taxRates).toEqual([5000, 9975]);
  });
  it("never offers pickup slots while lead time or capacity is unset", async () => {
    const { upcomingPickup } = await import("../src/pickup-policy");
    const { pickupPolicySchema } = await import("../src/pickup-policy");
    expect(upcomingPickup(pickupPolicySchema.parse(policy))).toEqual([]);
  });
});

describe("one-time business initialisation", () => {
  let seed: { profile: unknown; weeklyHours: unknown };
  beforeAll(async () => { seed = JSON.parse(await readFile("db/seeds/business-initial.json", "utf8")); });
  const run = async (withHours: boolean) => { for (const { sql, params } of buildStatements(seed, { withHours })) await local.current!.query(sql, params); };
  beforeEach(async () => { await q("DELETE FROM catalog_store_settings"); await q("DELETE FROM catalog_audit_history"); });
  it("writes the owner-supplied profile, flagged unverified, and no schedule by default", async () => {
    await run(false);
    const rows = await q("SELECT key, value FROM catalog_store_settings ORDER BY key");
    expect(rows.map(r => r.key)).toEqual(["business_profile"]);
    expect(rows[0].value).toMatchObject({ street: "1175 Rue Notre Dame", city: "Lachine", postalCode: "H8S 2C5", phone: "+1 514-637-6666", googlePlaceId: "ChIJNRlHTYMXyUwRdKR_YXvuGHA", verification: { status: "unverified" } });
    expect(JSON.stringify(rows[0].value)).not.toMatch(/@|instagram|facebook/i);
  });
  it("can seed the weekly hours (Monday to Saturday, Sunday closed) without inventing lead time, capacity, tax or prices", async () => {
    await run(true);
    const { value } = (await q("SELECT value FROM catalog_store_settings WHERE key = 'pickup_policy'"))[0] as { value: { hours: Record<string, string[][]>; leadMinutes?: number; slotCapacity?: number } };
    expect(Object.keys(value.hours).sort()).toEqual(["Fri", "Mon", "Sat", "Thu", "Tue", "Wed"]);
    expect(value.hours.Mon).toEqual([["10:30", "20:00"]]);
    expect(value.leadMinutes).toBeUndefined(); expect(value.slotCapacity).toBeUndefined();
    expect(await q("SELECT 1 FROM catalog_store_settings WHERE key IN ('fiscal_settings','pickup_checkout_enabled')")).toHaveLength(0);
    expect(await q("SELECT 1 FROM catalog_variants")).toHaveLength(0);
  });
  it("is idempotent and never overwrites values edited in the admin", async () => {
    await run(true);
    await q("UPDATE catalog_store_settings SET value = jsonb_set(value, '{phone}', '\"+1 514-111-2222\"') WHERE key = 'business_profile'");
    await q("UPDATE catalog_store_settings SET value = $1::jsonb WHERE key = 'pickup_policy'", [JSON.stringify({ hours: { Sun: [["09:00", "10:00"]] }, leadMinutes: 25, slotCapacity: 4 })]);
    await run(true); await run(true);
    expect((await q("SELECT value->>'phone' AS phone FROM catalog_store_settings WHERE key = 'business_profile'"))[0].phone).toBe("+1 514-111-2222");
    expect((await q("SELECT value->>'leadMinutes' AS lead FROM catalog_store_settings WHERE key = 'pickup_policy'"))[0].lead).toBe("25");
    expect(await q("SELECT 1 FROM catalog_audit_history WHERE action = 'business.init'")).toHaveLength(2);
  });
});
