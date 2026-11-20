"use server";

import QRCode from "qrcode";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { demoMode } from "../../../src/demo-mode";
import { customerAuth } from "../../../src/auth";
import { accountEmailAvailable, instantAccounts } from "../../../src/account-email";
import { customerSession } from "../../../src/customer";
import { database } from "../../../src/db";
import { language } from "../../../src/domain";
import { enroll, accountForUser, issueQr } from "../../../src/loyalty";
import { toggleFavorite } from "../../../src/favorites";
import { rotateIdentifier } from "../../../src/identification";
import { allow, clientAddress } from "../../../src/rate-limit";
import { currentGuestCard } from "../../../src/guest-card";

const email = z.email().max(254).transform(value => value.trim().toLowerCase());
const password = z.string().min(12).max(128);
const back = (lang: string, query: string): never => redirect(`/${lang}/account?${query}`);

export async function register(lang: string, form: FormData) {
  if (!language(lang)) return;
  const parsed = z.object({ name: z.string().trim().min(1).max(80), email, password, accept: z.literal("on") }).safeParse(Object.fromEntries(form));
  if (!parsed.success) back(lang, "error=register");
  const ip = clientAddress(await headers());
  const { name, email: address, password: secret } = parsed.data!;
  if (!await allow("register-ip", ip, 5, 3600) || !await allow("register-email", address, 3, 3600)) back(lang, "error=rate");
  const auth = customerAuth();
  if (!auth || !accountEmailAvailable()) back(lang, "error=unavailable");
  try {
    await auth!.api.signUpEmail({ body: { name, email: address, password: secret }, headers: await headers() });
  } catch { /* Identical outcome whether or not the address exists, so registration cannot be used to probe accounts. */ }
  back(lang, instantAccounts() ? "created=1" : "registered=1");
}

export async function login(lang: string, form: FormData) {
  if (!language(lang)) return;
  const parsed = z.object({ email, password: z.string().min(1).max(128) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) back(lang, "error=login");
  const ip = clientAddress(await headers());
  const { email: address, password: secret } = parsed.data!;
  if (!await allow("login-ip", ip, 20, 900) || !await allow("login-email", address, 8, 900)) back(lang, "error=rate");
  const auth = customerAuth();
  if (!auth) back(lang, "error=unavailable");
  let failed = false;
  try {
    await auth!.api.signInEmail({ body: { email: address, password: secret, rememberMe: true }, headers: await headers() });
  } catch { failed = true; }
  if (failed) back(lang, "error=login");
  // Demo mode: the Salut Rewards card exists from the first sign-in, so the whole stamp journey can be shown without an extra step.
  if (demoMode()) {
    const { rows: [user] } = await (await database()).query<{ id: string }>(`SELECT "id" FROM "user" WHERE "email" = $1 AND "role" = 'CUSTOMER'`, [address]);
    if (user) await enroll(user.id).catch(() => undefined);
  }
  redirect(`/${lang}/account`);
}

export async function logout(lang: string) {
  if (!language(lang)) return;
  const auth = customerAuth();
  if (auth) await auth.api.signOut({ headers: await headers() });
  redirect(`/${lang}/account`);
}

export async function forgotPassword(lang: string, form: FormData) {
  if (!language(lang)) return;
  const parsed = email.safeParse(form.get("email"));
  const ip = clientAddress(await headers());
  if (parsed.success && await allow("forgot-ip", ip, 5, 3600) && await allow("forgot-email", parsed.data, 3, 3600)) {
    const site = process.env.SITE_URL || process.env.BETTER_AUTH_URL;
    try {
      if (site && accountEmailAvailable()) await customerAuth()?.api.requestPasswordReset({ body: { email: parsed.data, redirectTo: new URL(`/${lang}/account/reset`, site).href } });
    } catch { /* Never reveal whether the address has an account. */ }
  }
  back(lang, "forgot=sent");
}

export async function resetPassword(lang: string, form: FormData) {
  if (!language(lang)) return;
  const parsed = z.object({ token: z.string().min(8).max(512), password }).safeParse({ token: form.get("token"), password: form.get("password") });
  if (!parsed.success) redirect(`/${lang}/account/reset?error=invalid`);
  if (!await allow("reset-ip", clientAddress(await headers()), 10, 3600)) redirect(`/${lang}/account/reset?error=rate`);
  let failed = false;
  try {
    await customerAuth()!.api.resetPassword({ body: { newPassword: parsed.data!.password, token: parsed.data!.token } });
  } catch { failed = true; }
  if (failed) redirect(`/${lang}/account/reset?error=invalid`);
  back(lang, "reset=ok");
}

export async function verifyEmail(lang: string, form: FormData) {
  if (!language(lang)) return;
  const token = z.string().min(8).max(2048).safeParse(form.get("token"));
  let failed = !token.success;
  if (token.success) {
    try { await customerAuth()!.api.verifyEmail({ query: { token: token.data } }); } catch { failed = true; }
  }
  back(lang, failed ? "error=verify" : "verified=1");
}

export async function updateProfile(lang: string, form: FormData) {
  if (!language(lang)) return;
  const session = await customerSession();
  const name = z.string().trim().min(1).max(80).safeParse(form.get("name"));
  if (!session || !name.success) back(lang, "error=profile");
  await (await database()).query(`UPDATE "user" SET "name" = $2, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $1 AND "role" = 'CUSTOMER'`, [session!.id, name.data!]);
  revalidatePath(`/${lang}/account`);
  back(lang, "saved=1");
}

export async function joinRewards(lang: string) {
  if (!language(lang)) return;
  const session = await customerSession();
  if (!session) back(lang, "error=login");
  await enroll(session!.id);
  redirect(`/${lang}/account/rewards`);
}

/** Issues a fresh single-use QR. The QR carries only a random token, never personal data or credentials. */
export async function newQr(lang: string): Promise<{ svg: string; expiresAt: string } | { error: "AUTH" | "RATE" | "ENROLL" }> {
  if (!language(lang)) return { error: "AUTH" };
  // A signed-in member's own account first; otherwise the guest card held by this browser.
  const session = await customerSession();
  const account = (session ? await accountForUser(session.id) : undefined) ?? (await currentGuestCard())?.account;
  if (!account) return { error: session ? "ENROLL" : "AUTH" };
  if (account.status !== "active") return { error: "ENROLL" };
  if (!await allow("qr-user", account.id, 20, 600)) return { error: "RATE" };
  const { token, expiresAt } = await issueQr(account.id);
  const h = await headers();
  const origin = process.env.SITE_URL || `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const svg = await QRCode.toString(new URL(`/${lang}/staff/rewards?t=${token}`, origin).href,
    { type: "svg", margin: 4, errorCorrectionLevel: "Q", color: { dark: "#4A2C1A", light: "#FFF8EF" } });
  return { svg, expiresAt };
}

/** The member (or guest card holder) replaces their own card QR: the old QR and Wallet barcode stop working at once. */
export async function replaceCardQr(lang: string) {
  if (!language(lang)) return;
  const session = await customerSession();
  const account = (session ? await accountForUser(session.id) : undefined) ?? (await currentGuestCard())?.account;
  if (!account || account.status !== "active") return;
  if (!await allow("qr-replace", account.id, 5, 3600)) return;
  await rotateIdentifier(account.id, `member:${account.member_code}`);
  revalidatePath(`/${lang}/account/rewards`);
}

/** Saves or removes a favorite drink for the signed-in customer. */
export async function toggleFavoriteAction(lang: string, productId: string) {
  if (!language(lang) || !/^[a-z0-9-]{1,64}$/.test(productId)) return;
  const session = await customerSession();
  if (!session) redirect(`/${lang}/account`);
  await toggleFavorite(session!.id, productId);
  revalidatePath(`/${lang}/account`);
  revalidatePath(`/${lang}/catalog/products/${productId}`);
}
