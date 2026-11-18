"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { database } from "../../../../src/db";
import { language } from "../../../../src/domain";
import { awardInStore, LoyaltyError, lookupQr, redeemReward } from "../../../../src/loyalty";
import { allow } from "../../../../src/rate-limit";
import { staffActor, staffRole } from "../../../../src/staff";

const token = z.string().regex(/^[0-9a-f]{64}$/);
const key = z.string().min(8).max(120);

/** Accepts the scanned link, the bare token, or text containing either. */
export async function identify(lang: string, form: FormData) {
  if (!language(lang)) return;
  const found = String(form.get("scan") ?? "").match(/[0-9a-f]{64}/)?.[0];
  redirect(`/${lang}/staff/rewards${found ? `?t=${found}` : "?error=QR_INVALID"}`);
}

export async function redeem(lang: string, form: FormData) {
  if (!language(lang) || !process.env.DATABASE_URL || !await staffRole()) return;
  const parsed = z.object({ token, reward: z.string().regex(/^[a-z0-9-]{1,48}$/), key }).safeParse({ token: form.get("token"), reward: form.get("reward"), key: form.get("key") });
  if (!parsed.success) redirect(`/${lang}/staff/rewards?error=QR_INVALID`);
  const actor = await staffActor();
  if (!await allow("redeem-staff", actor, 30, 60)) redirect(`/${lang}/staff/rewards?error=RATE`);
  try {
    const result = await redeemReward({ token: parsed.data!.token, rewardId: parsed.data!.reward, key: parsed.data!.key, actor });
    redirect(`/${lang}/staff/rewards?done=${encodeURIComponent(result.reward)}&balance=${result.balance}${result.duplicate ? "&dup=1" : ""}`);
  } catch (error) {
    if (error instanceof LoyaltyError) redirect(`/${lang}/staff/rewards?error=${error.code}`);
    throw error; // Next's redirect signal and unexpected failures propagate.
  }
}

export async function award(lang: string, form: FormData) {
  if (!language(lang) || !process.env.DATABASE_URL || !await staffRole()) return;
  const parsed = z.object({ token, key, amount: z.string().regex(/^\d{1,4}(\.\d{1,2})?$/) }).safeParse({ token: form.get("token"), key: form.get("key"), amount: form.get("amount") });
  if (!parsed.success) redirect(`/${lang}/staff/rewards?error=AMOUNT&t=${String(form.get("token") ?? "").slice(0, 64)}`);
  const actor = await staffActor();
  if (!await allow("award-staff", actor, 60, 60)) redirect(`/${lang}/staff/rewards?error=RATE`);
  const found = await lookupQr(parsed.data!.token, await database());
  if (!found) redirect(`/${lang}/staff/rewards?error=QR_INVALID`);
  try {
    const result = await awardInStore({ accountId: found!.accountId, cents: Math.round(Number(parsed.data!.amount) * 100), key: parsed.data!.key, actor });
    redirect(`/${lang}/staff/rewards?t=${parsed.data!.token}&awarded=${result.awarded}${result.balance === undefined ? "" : `&balance=${result.balance}`}`);
  } catch (error) {
    if (error instanceof LoyaltyError) redirect(`/${lang}/staff/rewards?t=${parsed.data!.token}&error=${error.code}`);
    throw error;
  }
}
