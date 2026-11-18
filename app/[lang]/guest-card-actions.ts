"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { customerSession } from "../../src/customer";
import { guestCookie, guestCookieOptions, currentGuestCard } from "../../src/guest-card";
import { language } from "../../src/domain";
import { createGuestCard, guestAccount, linkGuestCard, LoyaltyError } from "../../src/loyalty";
import { allow, clientAddress } from "../../src/rate-limit";
import { cardPath } from "../../src/rewards-paths";

const back = (lang: "fr" | "en", query = ""): never => redirect(`${cardPath[lang]}${query}`);

/** Creates a guest card for this browser. Rate limited per address so cards cannot be mass-produced. */
export async function getGuestCard(lang: string) {
  if (!language(lang) || !process.env.DATABASE_URL) return;
  if (!await allow("guest-card-create", clientAddress(await headers()), 5, 3600)) back(lang, "?error=rate");
  const { secret } = await createGuestCard();
  (await cookies()).set(guestCookie, secret, guestCookieOptions);
  back(lang, "?created=1");
}

/** Restores a card on another device from its backup code. The code is only ever compared by hash. */
export async function restoreGuestCard(lang: string, form: FormData) {
  if (!language(lang) || !process.env.DATABASE_URL) return;
  if (!await allow("guest-card-restore", clientAddress(await headers()), 10, 900)) back(lang, "?error=rate");
  const code = z.string().trim().toLowerCase().regex(/^[0-9a-f]{64}$/).safeParse(form.get("code"));
  const account = code.success ? await guestAccount(code.data) : undefined;
  if (!code.success || !account) back(lang, "?error=restore");
  (await cookies()).set(guestCookie, code.data!, guestCookieOptions);
  back(lang, "?restored=1");
}

/** Removes the card from this browser only. The card and its points stay in the database. */
export async function forgetGuestCard(lang: string) {
  if (!language(lang)) return;
  (await cookies()).delete(guestCookie);
  back(lang, "?forgotten=1");
}

/** Moves this browser's guest card into the signed-in customer's account (atomic; points move, never copy). */
export async function linkCardToAccount(lang: string) {
  if (!language(lang)) return;
  const session = await customerSession();
  if (!session) redirect(`/${lang}/account`);
  const card = await currentGuestCard();
  if (!card) redirect(`/${lang}/account/rewards?link=none`);
  if (!await allow("guest-card-link", session!.id, 10, 3600)) redirect(`/${lang}/account/rewards?link=rate`);
  try {
    const result = await linkGuestCard(card!.secret, session!.id);
    (await cookies()).delete(guestCookie);
    redirect(`/${lang}/account/rewards?link=ok&moved=${result.moved}`);
  } catch (error) {
    if (error instanceof LoyaltyError) redirect(`/${lang}/account/rewards?link=${error.code === "ACCOUNT_SUSPENDED" ? "suspended" : "none"}`);
    throw error;
  }
}
