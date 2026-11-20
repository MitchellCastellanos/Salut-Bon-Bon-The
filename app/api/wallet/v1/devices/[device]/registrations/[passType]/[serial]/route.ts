import { database } from "../../../../../../../../../src/db";
import { validAuthToken, walletConfig } from "../../../../../../../../../src/wallet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ device: string; passType: string; serial: string }> };

async function authorized(request: Request, { passType, serial }: { passType: string; serial: string }) {
  const config = walletConfig();
  return Boolean(config && passType === config.passTypeId && /^[0-9a-f]{32}$/.test(serial) && validAuthToken(serial, request.headers.get("authorization")));
}

/** Apple: a device registers to receive updates for a pass. */
export async function POST(request: Request, { params }: Context) {
  const p = await params;
  if (!await authorized(request, p)) return new Response(null, { status: 401 });
  const body = await request.json().catch(() => undefined) as { pushToken?: unknown } | undefined;
  if (typeof body?.pushToken !== "string" || !/^[0-9a-fA-F]{16,256}$/.test(body.pushToken) || p.device.length > 128) return new Response(null, { status: 400 });
  const { rows } = await (await database()).query(`
    INSERT INTO wallet_registrations (device_id, serial, push_token) SELECT $1, $2, $3 WHERE EXISTS (SELECT 1 FROM wallet_passes WHERE serial = $2)
    ON CONFLICT (device_id, serial) DO UPDATE SET push_token = EXCLUDED.push_token RETURNING (xmax = 0) AS created`, [p.device, p.serial, body.pushToken]);
  return new Response(null, { status: rows.length ? ((rows[0] as { created: boolean }).created ? 201 : 200) : 404 });
}

/** Apple: the device unregisters. */
export async function DELETE(request: Request, { params }: Context) {
  const p = await params;
  if (!await authorized(request, p)) return new Response(null, { status: 401 });
  await (await database()).query("DELETE FROM wallet_registrations WHERE device_id = $1 AND serial = $2", [p.device, p.serial]);
  return new Response(null, { status: 200 });
}
