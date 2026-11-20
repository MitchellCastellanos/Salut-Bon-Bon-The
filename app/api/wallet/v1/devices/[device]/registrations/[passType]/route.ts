import { database } from "../../../../../../../../src/db";
import { walletConfig } from "../../../../../../../../src/wallet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Apple: serial numbers of the passes on this device that changed since the last tag. */
export async function GET(request: Request, { params }: { params: Promise<{ device: string; passType: string }> }) {
  const { device, passType } = await params;
  const config = walletConfig();
  if (!config || passType !== config.passTypeId || device.length > 128) return new Response(null, { status: 404 });
  const since = Number(new URL(request.url).searchParams.get("passesUpdatedSince") ?? "0");
  const { rows } = await (await database()).query<{ serial: string; tag: string }>(`
    SELECT p.serial, (extract(epoch from p.last_updated_at) * 1000)::bigint::text AS tag
    FROM wallet_registrations r JOIN wallet_passes p ON p.serial = r.serial
    WHERE r.device_id = $1 AND (extract(epoch from p.last_updated_at) * 1000) > $2`, [device, Number.isFinite(since) ? since : 0]);
  if (!rows.length) return new Response(null, { status: 204 });
  return Response.json({ serialNumbers: rows.map(row => row.serial), lastUpdated: String(Math.max(...rows.map(row => Number(row.tag)))) });
}
