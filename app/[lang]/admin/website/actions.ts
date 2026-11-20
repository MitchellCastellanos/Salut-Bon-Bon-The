"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MenuError, audit, atomic, saveCollection } from "../../../../src/admin-menu";
import { database } from "../../../../src/db";
import { language } from "../../../../src/domain";
import { adminAction, flag, text } from "../guard";

const back = (lang: string, query: string): never => { revalidatePath(`/${lang}`, "layout"); return redirect(`/${lang}/admin/website?${query}`); };

export async function saveCampaign(lang: string, form: FormData) {
  const actor = await adminAction();
  if (!language(lang)) return;
  const date = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]);
  const parsed = z.object({
    id: z.enum(["fresh-mango-series", "creme-brulee", "house-lemonade", "explore-menu"]),
    starts: date, ends: date, position: z.string().regex(/^(|[1-9][0-9]?)$/),
    headlineFr: z.string().trim().min(1).max(200), headlineEn: z.string().trim().min(1).max(200),
    seoFr: z.string().trim().max(250), seoEn: z.string().trim().max(250),
    image: z.string().regex(/^(|\/(drinks|promotions)\/[a-z0-9_-]+\.webp)$/i),
  }).refine(row => !row.starts || !row.ends || row.starts <= row.ends).safeParse(Object.fromEntries(form));
  if (!parsed.success) return back(lang, "error=campaign");
  const input = parsed.data;
  const db = await database();
  // Dates are whole days in shop time: a campaign starts at midnight on its first day and ends at the end of its last day.
  await atomic(db, async tx => {
    await tx.query(`
      WITH changed AS (
        UPDATE marketing_campaigns SET published = $2, active = $3,
          starts_at = CASE WHEN $4 = '' THEN NULL ELSE ($4::date)::timestamp AT TIME ZONE 'America/Toronto' END,
          ends_at = CASE WHEN $5 = '' THEN NULL ELSE (($5::date) + 1)::timestamp AT TIME ZONE 'America/Toronto' END,
          homepage_position = $6 WHERE id = $1 RETURNING id
      ), copy AS (
        UPDATE marketing_campaign_translations AS t SET headline = CASE WHEN t.locale = 'fr' THEN $7 ELSE $8 END,
          seo_description = NULLIF(CASE WHEN t.locale = 'fr' THEN $9 ELSE $10 END, '') FROM changed WHERE t.campaign_id = changed.id
      ), removed_assets AS (DELETE FROM marketing_campaign_assets a USING changed WHERE a.campaign_id = changed.id AND a.path <> $11
      ), assets AS (INSERT INTO marketing_campaign_assets SELECT id, $11 FROM changed WHERE $11 <> '' ON CONFLICT DO NOTHING)
      SELECT 1`, [input.id, flag(form, "published"), flag(form, "active"), input.starts, input.ends, input.position ? Number(input.position) : null,
      input.headlineFr, input.headlineEn, input.seoFr, input.seoEn, input.image]);
    await audit(tx, "campaign.update", input.id, { published: flag(form, "published"), active: flag(form, "active"), starts: input.starts, ends: input.ends, position: input.position }, actor);
  });
  back(lang, "saved=campaign");
}

export async function saveCollectionAction(lang: string, form: FormData) {
  const actor = await adminAction();
  if (!language(lang)) return;
  try { await saveCollection({ id: text(form, "id"), fr: text(form, "fr"), en: text(form, "en"), products: form.getAll("products").map(String) }, actor); }
  catch (error) { if (error instanceof MenuError) return back(lang, `error=${error.code}`); throw error; }
  back(lang, "saved=collection");
}
