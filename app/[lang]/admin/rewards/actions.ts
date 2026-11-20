"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { database } from "../../../../src/db";
import { language } from "../../../../src/domain";
import { adjustPoints, LoyaltyError, reverseForRefund, saveProgramConfig } from "../../../../src/loyalty";
import { staffActor, staffRole } from "../../../../src/staff";

async function admin() {
  if (!process.env.DATABASE_URL || await staffRole() !== "ADMIN") throw new Error("Forbidden");
  return staffActor();
}
const dollars = z.string().regex(/^\d{1,4}(\.\d{1,2})?$/);
const back = (lang: string, query: string): never => redirect(`/${lang}/admin/rewards?${query}`);

export async function saveProgram(lang: string, form: FormData) {
  const actor = await admin();
  if (!language(lang)) return;
  const parsed = z.object({
    min: z.union([z.literal(""), dollars]),
  }).safeParse({ min: form.get("min") ?? "" });
  if (!parsed.success) back(lang, "error=program");
  const flag = (name: string) => form.get(name) === "on";
  const categories = form.getAll("category").map(String).filter(value => /^[a-z0-9-]{1,48}$/.test(value));
  try {
    await saveProgramConfig({
      active: flag("active"),
      minOrderCents: parsed.data!.min ? Math.round(Number(parsed.data!.min) * 100) : 0, categories,
      previewVisible: flag("previewVisible"), accrualEnabled: flag("accrualEnabled"), redemptionEnabled: flag("redemptionEnabled"),
      commercialAuthorized: flag("commercialAuthorized"),
    }, actor, { production: process.env.VERCEL_ENV === "production" });
  } catch (error) {
    back(lang, `error=${error instanceof LoyaltyError ? error.code : "program"}`);
  }
  revalidatePath(`/${lang}/admin/rewards`);
  back(lang, "saved=program");
}

export async function saveReward(lang: string, form: FormData) {
  const actor = await admin();
  if (!language(lang)) return;
  const parsed = z.object({
    id: z.string().regex(/^[a-z0-9-]{1,48}$/),
    nameFr: z.string().trim().min(1).max(120), nameEn: z.string().trim().min(1).max(120),
    descFr: z.string().trim().max(400), descEn: z.string().trim().max(400),
    cost: z.string().regex(/^\d{1,6}$/).transform(Number).refine(v => v >= 1 && v <= 100000),
    category: z.string().regex(/^[a-z0-9-]*$/), product: z.string().regex(/^[A-Za-z0-9-]*$/),
    discount: z.union([z.literal(""), dollars]),
  }).safeParse(Object.fromEntries(form));
  if (!parsed.success || (parsed.data.category && parsed.data.product)) back(lang, "error=reward");
  const r = parsed.data!;
  try {
    await (await database()).query(`
      WITH saved AS (
        INSERT INTO loyalty_rewards (id, name_fr, name_en, description_fr, description_en, points_cost, available, eligible_category, eligible_product_id, discount_cents, preview_visible)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NULLIF($8, ''), NULLIF($9, ''), $11, $12)
        ON CONFLICT (id) DO UPDATE SET name_fr = EXCLUDED.name_fr, name_en = EXCLUDED.name_en, description_fr = EXCLUDED.description_fr,
          description_en = EXCLUDED.description_en, points_cost = EXCLUDED.points_cost, available = EXCLUDED.available,
          eligible_category = EXCLUDED.eligible_category, eligible_product_id = EXCLUDED.eligible_product_id,
          discount_cents = EXCLUDED.discount_cents, preview_visible = EXCLUDED.preview_visible
        RETURNING id, points_cost, available, discount_cents, preview_visible
      ) INSERT INTO catalog_audit_history (action, subject, details) SELECT 'loyalty.reward', id, to_jsonb(saved) || jsonb_build_object('actor', $10::text) FROM saved
    `, [r.id, r.nameFr, r.nameEn, r.descFr, r.descEn, r.cost, form.get("available") === "on", r.category, r.product, actor,
      r.discount ? Math.round(Number(r.discount) * 100) : null, form.get("previewVisible") === "on"]);
  } catch { back(lang, "error=reward"); }
  revalidatePath(`/${lang}/admin/rewards`);
  back(lang, "saved=reward");
}

export async function adjust(lang: string, form: FormData) {
  const actor = await admin();
  if (!language(lang)) return;
  const parsed = z.object({
    account: z.uuid(), points: z.string().regex(/^-?\d{1,6}$/).transform(Number), reason: z.string().trim().min(3).max(300),
    key: z.string().min(8).max(120), q: z.string().max(254),
  }).safeParse(Object.fromEntries(form));
  if (!parsed.success) back(lang, "error=adjust");
  const a = parsed.data!;
  try {
    await adjustPoints({ accountId: a.account, points: a.points, reason: a.reason, key: a.key, actor });
  } catch (error) {
    back(lang, `q=${encodeURIComponent(a.q)}&error=${error instanceof LoyaltyError ? error.code : "adjust"}`);
  }
  revalidatePath(`/${lang}/admin/rewards`);
  back(lang, `q=${encodeURIComponent(a.q)}&saved=adjust`);
}

export async function setAccountStatus(lang: string, form: FormData) {
  const actor = await admin();
  if (!language(lang)) return;
  const parsed = z.object({ account: z.uuid(), status: z.enum(["active", "suspended"]), q: z.string().max(254) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) back(lang, "error=adjust");
  await (await database()).query(`
    WITH saved AS (UPDATE loyalty_accounts SET status = $2 WHERE id = $1 RETURNING id, status)
    INSERT INTO catalog_audit_history (action, subject, details) SELECT 'loyalty.account', id::text, to_jsonb(saved) || jsonb_build_object('actor', $3::text) FROM saved
  `, [parsed.data!.account, parsed.data!.status, actor]);
  back(lang, `q=${encodeURIComponent(parsed.data!.q)}&saved=account`);
}

export async function recordRefund(lang: string, form: FormData) {
  const actor = await admin();
  if (!language(lang)) return;
  const parsed = z.object({ order: z.string().regex(/^[1-9]\d{0,17}$/), amount: dollars, reason: z.string().trim().min(3).max(280), key: z.string().min(8).max(120) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) back(lang, "error=refund");
  const r = parsed.data!;
  try {
    const result = await reverseForRefund({ order: r.order, refundCents: Math.round(Number(r.amount) * 100), reason: r.reason, key: r.key, actor });
    revalidatePath(`/${lang}/admin/rewards`);
    back(lang, `saved=refund&reversed=${result.reversed}&shortfall=${result.shortfall}`);
  } catch (error) {
    if (error instanceof LoyaltyError) back(lang, `error=${error.code}`);
    throw error;
  }
}
