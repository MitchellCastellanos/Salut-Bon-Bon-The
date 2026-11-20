import { currentPass, validAuthToken, walletConfig } from "../../../../../../../src/wallet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Apple: the latest version of an installed pass. */
export async function GET(request: Request, { params }: { params: Promise<{ passType: string; serial: string }> }) {
  const { passType, serial } = await params;
  const config = walletConfig();
  if (!config || passType !== config.passTypeId || !/^[0-9a-f]{32}$/.test(serial)) return new Response(null, { status: 404 });
  if (!validAuthToken(serial, request.headers.get("authorization"))) return new Response(null, { status: 401 });
  const pass = await currentPass(serial);
  if (!pass) return new Response(null, { status: 404 });
  const since = request.headers.get("if-modified-since");
  if (since && Date.parse(since) >= Math.floor(pass.updatedAt.getTime() / 1000) * 1000) return new Response(null, { status: 304 });
  return new Response(new Uint8Array(pass.data), { headers: { "Content-Type": "application/vnd.apple.pkpass", "Last-Modified": pass.updatedAt.toUTCString(), "Cache-Control": "no-store" } });
}
