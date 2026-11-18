import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const globalPool = globalThis as typeof globalThis & { salutDemoPool?: Pool };
const pool = () => {
  if (!process.env.DEMO_DATABASE_URL) throw new Error("Demo database not configured");
  return globalPool.salutDemoPool ??= new Pool({ connectionString: process.env.DEMO_DATABASE_URL, max: 3 });
};
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const noStore = { "Cache-Control": "no-store" };
const schema = z.object({
  name: z.string().trim().min(1).max(80),
  pickup: z.enum(["14:00", "14:30", "15:00", "15:30"]),
  lines: z.array(z.object({ product: z.string().min(1).max(64).regex(/^[a-zA-Z0-9-]+$/), size: z.enum(["regular", "large"]), topping: z.enum(["none", "pearls", "popping"]), quantity: z.number().int().min(1).max(10) })).min(1).max(20),
});
const idSchema = z.string().uuid();
const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
function error(message: string, status: number) { return NextResponse.json({ error: message }, { status, headers: noStore }); }

export async function POST(req: NextRequest) {
  if (!process.env.DEMO_DATABASE_URL) return error("DEMO_UNAVAILABLE", 503);
  let body: unknown;
  try { body = await req.json(); } catch { return error("BAD_JSON", 400); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return error("INVALID_ORDER", 400);
  try {
    const ip = req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const clientHash = hash((process.env.DEMO_RATE_SALT ?? "salut-demo") + ":" + ip);
    await pool().query("DELETE FROM demo_orders WHERE expires_at < now()");
    const recent = await pool().query<{ count: string }>("SELECT count(*)::text AS count FROM demo_orders WHERE client_hash=$1 AND created_at > now() - interval '1 hour'", [clientHash]);
    if (Number(recent.rows[0]?.count ?? 0) >= 20) return error("DEMO_RATE_LIMIT", 429);
    const ids = [...new Set(parsed.data.lines.map(line => line.product))];
    const { rows } = await pool().query<{ id: string; size: string; cents: number; fr: string; en: string }>(`
      SELECT p.id, v.id AS size, coalesce(v.promotional_cents,v.price_cents) AS cents, fr.name AS fr, en.name AS en
      FROM catalog_products p
      JOIN catalog_variants v ON v.product_id=p.id
      JOIN catalog_product_translations fr ON fr.product_id=p.id AND fr.locale='fr'
      JOIN catalog_product_translations en ON en.product_id=p.id AND en.locale='en'
      WHERE p.id=ANY($1::text[]) AND v.available AND v.id IN ('regular','large')
        AND v.price_cents > 0
    `, [ids]);
    const lines = parsed.data.lines.map(line => {
      const match = rows.find(row => row.id === line.product && row.size === line.size);
      if (!match) throw new Error("PRODUCT_UNAVAILABLE");
      const unit = Number(match.cents) + (line.topping === "none" ? 0 : 75);
      return { ...line, fr: match.fr, en: match.en, unit, subtotal: unit * line.quantity };
    });
    const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0);
    const gst = Math.round(subtotal * 0.05);
    const qst = Math.round(subtotal * 0.09975);
    const tax = gst + qst;
    const points = Math.floor(subtotal * 10 / 100);
    const id = randomUUID();
    const token = randomBytes(32).toString("hex");
    await pool().query(`INSERT INTO demo_orders (id,access_token_hash,name,lines,subtotal_cents,tax_cents,total_cents,points,pickup,client_hash)
      VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10)`,
      [id, hash(token), parsed.data.name, JSON.stringify(lines), subtotal, tax, subtotal + tax, points, parsed.data.pickup, clientHash]);
    return NextResponse.json({ id, token, status: 0, lines, name: parsed.data.name, pickup: parsed.data.pickup, subtotal, gst, qst, total: subtotal + tax, points }, { status: 201, headers: noStore });
  } catch (err) {
    if (err instanceof Error && err.message === "PRODUCT_UNAVAILABLE") return error("PRODUCT_UNAVAILABLE", 400);
    console.error("Demo order creation failed", err instanceof Error ? err.name : "Unknown error");
    return error("DEMO_UNAVAILABLE", 503);
  }
}
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const token = req.nextUrl.searchParams.get("token");
  if (!idSchema.safeParse(id).success || !tokenSchema.safeParse(token).success) return error("NOT_FOUND", 404);
  try {
    const { rows } = await pool().query(`SELECT id,name,lines,subtotal_cents,tax_cents,total_cents,points,pickup,status,created_at
      FROM demo_orders WHERE id=$1 AND access_token_hash=$2 AND expires_at > now()`, [id, hash(token!)]);
    if (!rows.length) return error("NOT_FOUND", 404);
    return NextResponse.json(rows[0], { headers: noStore });
  } catch { return error("DEMO_UNAVAILABLE", 503); }
}
export async function PATCH(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return error("BAD_JSON", 400); }
  const parsed = z.object({ id: idSchema, token: tokenSchema }).safeParse(body);
  if (!parsed.success) return error("INVALID_ORDER", 400);
  try {
    const { rows } = await pool().query(`UPDATE demo_orders SET status=status+1 WHERE id=$1 AND access_token_hash=$2
      AND expires_at > now() AND status < 4 RETURNING status`, [parsed.data.id, hash(parsed.data.token)]);
    if (!rows.length) return error("NOT_FOUND_OR_COMPLETE", 404);
    return NextResponse.json({ status: rows[0].status }, { headers: noStore });
  } catch { return error("DEMO_UNAVAILABLE", 503); }
}
