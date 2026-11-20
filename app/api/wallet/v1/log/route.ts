export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Apple: devices report pass errors here. Only a count is logged: no payload is stored or echoed. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => undefined) as { logs?: unknown } | undefined;
  console.error("apple wallet device log", { entries: Array.isArray(body?.logs) ? body.logs.length : 0 });
  return new Response(null, { status: 200 });
}
