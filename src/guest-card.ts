import { cookies } from "next/headers";
import { guestAccount } from "./loyalty";

export const guestCookie = "salut-guest-card";

/** The guest card presented by this browser, or undefined. The cookie only carries the secret; the database is authoritative. */
export async function currentGuestCard() {
  const secret = (await cookies()).get(guestCookie)?.value;
  if (!secret || !process.env.DATABASE_URL) return undefined;
  const account = await guestAccount(secret).catch(() => undefined);
  return account ? { secret, account } : undefined;
}

export const guestCookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 };
