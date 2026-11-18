import { createHash } from "node:crypto";
import { database } from "./db";

type Db = { query<T extends Record<string, unknown>>(sql: string, args?: unknown[]): Promise<{ rows: T[] }> };

/** Fixed-window limiter shared by every instance through PostgreSQL. Subjects are hashed before storage. */
export async function allow(bucket: string, subject: string, limit: number, windowSeconds: number, db?: Db) {
  const key = `${bucket}:${createHash("sha256").update(subject).digest("hex").slice(0, 32)}`;
  const connection = db ?? await database();
  const { rows: [row] } = await connection.query<{ hits: number }>(`
    INSERT INTO rate_limits (key, window_start, hits) VALUES ($1, now(), 1)
    ON CONFLICT (key) DO UPDATE SET
      window_start = CASE WHEN rate_limits.window_start < now() - make_interval(secs => $2::int) THEN now() ELSE rate_limits.window_start END,
      hits = CASE WHEN rate_limits.window_start < now() - make_interval(secs => $2::int) THEN 1 ELSE rate_limits.hits + 1 END
    RETURNING hits
  `, [key, windowSeconds]);
  return row.hits <= limit;
}

export function clientAddress(headers: Headers) {
  return headers.get("x-vercel-forwarded-for")?.split(",")[0].trim() ||
    headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}
