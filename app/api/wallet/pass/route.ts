import { customerSession } from "../../../../src/customer";
import { currentGuestCard } from "../../../../src/guest-card";
import { accountForUser } from "../../../../src/loyalty";
import { allow } from "../../../../src/rate-limit";
import { issuePass, walletConfigured } from "../../../../src/wallet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** "Add to Apple Wallet": the signed pass for the signed-in member (or the guest card held by this browser). */
export async function GET(request: Request) {
  if (!walletConfigured()) return new Response("Apple Wallet is not configured", { status: 404 });
  const lang = new URL(request.url).searchParams.get("lang") === "en" ? "en" : "fr";
  const session = await customerSession().catch(() => undefined);
  const account = (session ? await accountForUser(session.id) : undefined) ?? (await currentGuestCard().catch(() => undefined))?.account;
  if (!account || account.status !== "active") return new Response("Not available", { status: 403 });
  if (!await allow("wallet-pass", account.id, 10, 3600)) return new Response("Too many requests", { status: 429 });
  try {
    const pass = await issuePass(account.id, lang);
    return new Response(new Uint8Array(pass), { headers: { "Content-Type": "application/vnd.apple.pkpass", "Content-Disposition": 'attachment; filename="salut-rewards.pkpass"', "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("wallet pass failed", { message: error instanceof Error ? error.message : "unknown" });
    return new Response("Pass unavailable", { status: 500 });
  }
}
