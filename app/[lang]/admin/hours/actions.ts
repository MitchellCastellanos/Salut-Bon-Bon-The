"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { database } from "../../../../src/db";
import { language } from "../../../../src/domain";
import { days, exceptionSchema, pickupPolicySchema, type Day } from "../../../../src/pickup-policy";
import { staffActor, staffRole } from "../../../../src/staff";

const whole = (min: number, max: number) => z.string().regex(/^\d{1,4}$/).transform(Number).refine(v => v >= min && v <= max);
const optionalWhole = (min: number, max: number) => z.union([z.literal("").transform(() => undefined), whole(min, max)]);

export async function savePickupSettings(lang: string, form: FormData) {
  if (!process.env.DATABASE_URL || await staffRole() !== "ADMIN") throw new Error("Forbidden");
  if (!language(lang)) return;
  const fail = (message: string): never => redirect(`/${lang}/admin/hours?error=${encodeURIComponent(message.slice(0, 160))}`);
  const get = (key: string) => String(form.get(key) ?? "");
  const hours: Partial<Record<Day, [string, string][]>> = {};
  for (const day of days) {
    if (get(`${day}_open`) !== "on") continue;
    const list: [string, string][] = [];
    for (let i = 0; i < 4; i++) {
      const start = get(`${day}_${i}_start`), end = get(`${day}_${i}_end`);
      if (start || end) list.push([start, end === "00:00" ? "24:00" : end]);
    }
    hours[day] = list;
  }
  let exceptions: unknown = [];
  try { exceptions = JSON.parse(get("exceptions") || "[]"); } catch { fail("Invalid exceptions"); }
  const numbers = z.object({
    lead: optionalWhole(5, 1440), slot: whole(5, 60), capacity: optionalWhole(1, 500), advance: whole(1, 60),
    cutoff: z.union([z.literal(""), z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)]),
  }).safeParse({ lead: get("lead"), slot: get("slot"), capacity: get("capacity"), advance: get("advance"), cutoff: get("cutoff") });
  if (!numbers.success) fail("Check the numeric fields");
  const n = numbers.data!;
  const policy = pickupPolicySchema.safeParse({
    leadMinutes: n.lead, slotMinutes: n.slot, slotCapacity: n.capacity, advanceDays: n.advance,
    sameDayCutoff: n.cutoff || null, hours,
    exceptions: z.array(exceptionSchema).max(200).catch([]).parse(exceptions),
  });
  if (!policy.success) fail(policy.error.issues[0]?.message ?? "Invalid schedule");
  if (Array.isArray(exceptions) && exceptions.length !== policy.data!.exceptions?.length) fail("An exceptional schedule is invalid");
  const enabled = form.get("enabled") === "on";
  const actor = await staffActor();
  await (await database()).query(`
    WITH saved AS (
      INSERT INTO catalog_store_settings (key, value) VALUES ('pickup_policy', $1::jsonb), ('pickup_checkout_enabled', $2::jsonb)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value RETURNING key, value
    ) INSERT INTO catalog_audit_history (action, subject, details) SELECT 'store.update', key, jsonb_build_object('value', value, 'actor', $3::text) FROM saved
  `, [JSON.stringify(policy.data), JSON.stringify(enabled), actor]);
  revalidatePath(`/${lang}`, "layout");
  redirect(`/${lang}/admin/hours?saved=1`);
}
