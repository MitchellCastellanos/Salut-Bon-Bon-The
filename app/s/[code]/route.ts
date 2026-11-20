import { NextResponse } from "next/server";
import { identifierPattern } from "../../../src/identification";

export const dynamic = "force-dynamic";

/**
 * Target of the card QR and the Wallet barcode. It resolves nothing by itself: it only forwards to the staff scanner, which requires a
 * staff sign-in. Anyone else (including a customer who opens the link) sees the staff sign-in page and learns nothing.
 */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const value = code.toUpperCase();
  const target = new URL(identifierPattern.test(value) ? `/en/staff/rewards?id=${value}` : "/en/staff/rewards", request.url);
  const response = NextResponse.redirect(target, 307);
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Cache-Control", "no-store");
  return response;
}
