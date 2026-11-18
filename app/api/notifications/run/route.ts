import { timingSafeEqual } from "node:crypto";
import { deliverPendingEmails } from "../../../../src/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Retries queued transactional email. Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const ok = secret.length >= 32 && given.length === expected.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return new Response("Unauthorized", { status: 401 });
  return Response.json(await deliverPendingEmails({ limit: 25 }));
}
