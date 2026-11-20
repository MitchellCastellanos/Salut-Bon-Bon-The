"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { database } from "../../../../src/db";
import { language } from "../../../../src/domain";
import { identifierPattern, lookupIdentifier } from "../../../../src/identification";
import { awardInStore, LoyaltyError, lookupQr, redeemForMember, redeemReward } from "../../../../src/loyalty";
import { allow } from "../../../../src/rate-limit";
import { maxStampsPerOrder } from "../../../../src/rewards-math";
import { staffActor, staffRole } from "../../../../src/staff";

const token = z.string().regex(/^[0-9a-f]{64}$/);
const key = z.string().min(8).max(120);

/** Accepts the scanned link, the bare token, or text containing either. */
export async function identify(lang: string, form: FormData) {
  if (!language(lang)) return;
  const text = String(form.get("scan") ?? "");
  const found = text.match(/[0-9a-f]{64}/)?.[0];
  const stable = text.toUpperCase().match(/[A-Z2-9]{22}/)?.[0];
  redirect(`/${lang}/staff/rewards${found ? `?t=${found}` : stable ? `?id=${stable}` : "?error=QR_INVALID"}`);
}

export async function redeem(lang: string, form: FormData) {
  if (!language(lang) || !process.env.DATABASE_URL || !await staffRole()) return;
  const stableId = String(form.get("id") ?? "");
  const parsed = z.object({ token: token.optional(), reward: z.string().regex(/^[a-z0-9-]{1,48}$/), key }).safeParse({ token: form.get("token") || undefined, reward: form.get("reward"), key: form.get("key") });
  if (!parsed.success || (!parsed.data.token && !identifierPattern.test(stableId))) redirect(`/${lang}/staff/rewards?error=QR_INVALID`);
  const actor = await staffActor();
  if (!await allow("redeem-staff", actor, 30, 60)) redirect(`/${lang}/staff/rewards?error=RATE`);
  try {
    let result;
    if (parsed.data!.token) result = await redeemReward({ token: parsed.data!.token, rewardId: parsed.data!.reward, key: parsed.data!.key, actor });
    else {
      // Stable identifier: staff must confirm that the member is present; the member is resolved again on the server.
      if (form.get("present") !== "on") redirect(`/${lang}/staff/rewards?id=${stableId}&error=CONFIRM`);
      const member = await lookupIdentifier(stableId, await database());
      if (!member) redirect(`/${lang}/staff/rewards?error=QR_INVALID`);
      if (member!.status !== "active") redirect(`/${lang}/staff/rewards?id=${stableId}&error=ACCOUNT_SUSPENDED`);
      result = await redeemForMember({ accountId: member!.accountId, rewardId: parsed.data!.reward, key: parsed.data!.key, actor });
    }
    redirect(`/${lang}/staff/rewards?done=${encodeURIComponent(result.reward)}&balance=${result.balance}${result.duplicate ? "&dup=1" : ""}`);
  } catch (error) {
    if (error instanceof LoyaltyError) redirect(`/${lang}/staff/rewards?${stableId && !parsed.data?.token ? `id=${stableId}&` : ""}error=${error.code}`);
    throw error; // Next's redirect signal and unexpected failures propagate.
  }
}

export async function award(lang: string, form: FormData) {
  if (!language(lang) || !process.env.DATABASE_URL || !await staffRole()) return;
  const stableId = String(form.get("id") ?? "");
  const parsed = z.object({ token: token.optional(), key, drinks: z.string().regex(/^\d{1,2}$/).transform(Number).refine(v => v >= 1 && v <= maxStampsPerOrder) })
    .safeParse({ token: form.get("token") || undefined, key: form.get("key"), drinks: form.get("drinks") });
  const back = stableId ? `id=${stableId}` : `t=${String(form.get("token") ?? "").slice(0, 64)}`;
  if (!parsed.success || (!parsed.data.token && !identifierPattern.test(stableId))) redirect(`/${lang}/staff/rewards?error=AMOUNT&${back}`);
  const actor = await staffActor();
  if (!await allow("award-staff", actor, 60, 60)) redirect(`/${lang}/staff/rewards?error=RATE`);
  const found = parsed.data!.token ? await lookupQr(parsed.data!.token, await database()) : await lookupIdentifier(stableId, await database());
  if (!found) redirect(`/${lang}/staff/rewards?error=QR_INVALID`);
  try {
    const result = await awardInStore({ accountId: found!.accountId, drinks: parsed.data!.drinks, key: parsed.data!.key, actor });
    redirect(`/${lang}/staff/rewards?${back}&awarded=${result.awarded}${result.balance === undefined ? "" : `&balance=${result.balance}`}`);
  } catch (error) {
    if (error instanceof LoyaltyError) redirect(`/${lang}/staff/rewards?${back}&error=${error.code}`);
    throw error;
  }
}
