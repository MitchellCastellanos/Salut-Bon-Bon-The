"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { database } from "../../../../src/db";
import { language } from "../../../../src/domain";
import { adjustPoints, LoyaltyError } from "../../../../src/loyalty";
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
    rate: z.union([z.literal(""), z.string().regex(/^\d{1,3}$/)]),
    min: z.union([z.literal(""), dollars]),
  }).safeParse({ rate: form.get("rate") ?? "", min: form.get("min") ?? "" });
  const rate = parsed.success && parsed.data.rate ? Number(parsed.data.rate) : null;
  if (!parsed.success || (rate !== null && (rate < 1 || rate > 100))) back(lang, "error=program");
  const active = form.get("active") === "on";
  // Activation needs an explicit earning rate: an unconfigured program can never award points.
  if (active && rate === null) back(lang, "error=rate");
  const categories = form.getAll("category").map(String).filter(value => /^[a-z0-9-]{1,48}$/.test(value));
  const db = await database();
  await db.query(`
    WITH saved AS (
      UPDATE loyalty_program SET active = $1, points_per_dollar = $2,
        earn_categories = (SELECT CASE WHEN count(*) = 0 THEN NULL ELSE array_agg(id) END FROM catalog_categories WHERE id = ANY($3::text[])),
        min_order_cents = $4, updated_at = now(), updated_by = $5
      WHERE id = 1 RETURNING active, points_per_dollar, earn_categories, min_order_cents
    ) INSERT INTO catalog_audit_history (action, subject, details) SELECT 'loyalty.program', 'program', to_jsonb(saved) || jsonb_build_object('actor', $5::text) FROM saved
  `, [active, rate, categories, parsed.data!.min ? Math.round(Number(parsed.data!.min) * 100) : 0, actor]);
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
  }).safeParse(Object.fromEntries(form));
  if (!parsed.success || (parsed.data.category && parsed.data.product)) back(lang, "error=reward");
  const r = parsed.data!;
  try {
    await (await database()).query(`
      WITH saved AS (
        INSERT INTO loyalty_rewards (id, name_fr, name_en, description_fr, description_en, points_cost, available, eligible_category, eligible_product_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NULLIF($8, ''), NULLIF($9, ''))
        ON CONFLICT (id) DO UPDATE SET name_fr = EXCLUDED.name_fr, name_en = EXCLUDED.name_en, description_fr = EXCLUDED.description_fr,
          description_en = EXCLUDED.description_en, points_cost = EXCLUDED.points_cost, available = EXCLUDED.available,
          eligible_category = EXCLUDED.eligible_category, eligible_product_id = EXCLUDED.eligible_product_id
        RETURNING id, points_cost, available
      ) INSERT INTO catalog_audit_history (action, subject, details) SELECT 'loyalty.reward', id, to_jsonb(saved) || jsonb_build_object('actor', $10::text) FROM saved
    `, [r.id, r.nameFr, r.nameEn, r.descFr, r.descEn, r.cost, form.get("available") === "on", r.category, r.product, actor]);
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
