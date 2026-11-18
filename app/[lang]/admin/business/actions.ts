"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { database } from "../../../../src/db";
import { language } from "../../../../src/domain";
import { fiscalSchema, profileSchema } from "../../../../src/business";
import { staffActor, staffRole } from "../../../../src/staff";

async function admin() {
  if (!process.env.DATABASE_URL || await staffRole() !== "ADMIN") throw new Error("Forbidden");
  return staffActor();
}
const field = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

async function store(key: string, value: unknown, actor: string, action: string) {
  await (await database()).query(`
    WITH saved AS (
      INSERT INTO catalog_store_settings (key, value) VALUES ($1, $2::jsonb)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value RETURNING key, value
    ) INSERT INTO catalog_audit_history (action, subject, details) SELECT $4, key, jsonb_build_object('value', value, 'actor', $3::text) FROM saved
  `, [key, JSON.stringify(value), actor, action]);
}

export async function saveBusinessProfile(lang: string, form: FormData) {
  const actor = await admin();
  if (!language(lang)) return;
  const confirmed = form.get("confirmed") === "on";
  const parsed = profileSchema.safeParse({
    displayName: field(form, "displayName"), street: field(form, "street"), city: field(form, "city"), province: field(form, "province"),
    postalCode: field(form, "postalCode"), country: field(form, "country"), phone: field(form, "phone"),
    googlePlaceId: field(form, "googlePlaceId") || undefined,
    verification: { status: confirmed ? "verified" : "unverified", note: field(form, "note") || undefined, sources: field(form, "sources").split(/\s+/).filter(Boolean) },
  });
  if (!parsed.success) redirect(`/${lang}/admin/business?error=${encodeURIComponent(parsed.error.issues[0]?.path.join(".") || "profile")}`);
  await store("business_profile", parsed.data, actor, "business.profile");
  revalidatePath(`/${lang}`, "layout");
  redirect(`/${lang}/admin/business?saved=profile`);
}

export async function saveFiscalSettings(lang: string, form: FormData) {
  const actor = await admin();
  if (!language(lang)) return;
  const rate = (key: string) => Math.round(Number(field(form, key) || "NaN") * 1000);
  const parsed = fiscalSchema.safeParse({
    status: field(form, "status"), legalName: field(form, "legalName") || undefined,
    gstNumber: field(form, "gstNumber").toUpperCase() || undefined, qstNumber: field(form, "qstNumber").toUpperCase() || undefined,
    gstRate: rate("gstRate"), qstRate: rate("qstRate"), receiptNote: field(form, "receiptNote") || undefined,
  });
  if (!parsed.success) redirect(`/${lang}/admin/business?error=${encodeURIComponent(`fiscal.${parsed.error.issues[0]?.path.join(".") || "status"}`)}`);
  await store("fiscal_settings", parsed.data, actor, "business.fiscal");
  revalidatePath(`/${lang}`, "layout");
  redirect(`/${lang}/admin/business?saved=fiscal`);
}
