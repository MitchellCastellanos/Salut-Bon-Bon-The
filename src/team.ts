import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { database } from "./db";

export type TeamRole = "STAFF" | "ADMIN";
export type TeamMember = { id: string; name: string; email: string; role: TeamRole; created_at: Date | string };

export const newMember = z.object({
  role: z.enum(["STAFF", "ADMIN"]),
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z.string().min(12).max(128),
});

export async function listTeam(): Promise<TeamMember[]> {
  const db = await database();
  return (await db.query<TeamMember>(`SELECT "id", "name", "email", "role", "createdAt" AS created_at FROM "user" WHERE "role" IN ('STAFF', 'ADMIN') ORDER BY "role", "createdAt"`)).rows;
}

/** Creates a staff or admin identity with a verified email and a credential account. Returns false when the email is taken. */
export async function createMember(input: z.infer<typeof newMember>) {
  const db = await database();
  const hash = await hashPassword(input.password);
  const id = randomUUID();
  const { rows } = await db.query(`
    WITH created AS (
      INSERT INTO "user" ("id", "name", "email", "role", "emailVerified") VALUES ($1, $2, $3, $4, true)
      ON CONFLICT ("email") DO NOTHING RETURNING "id"
    ) INSERT INTO "account" ("id", "accountId", "providerId", "userId", "password", "updatedAt")
      SELECT $5, "id", 'credential', "id", $6, CURRENT_TIMESTAMP FROM created RETURNING "id"
  `, [id, input.name, input.email, input.role, randomUUID(), hash]);
  return rows.length > 0;
}

async function otherAdmins(db: Awaited<ReturnType<typeof database>>, id: string) {
  const { rows: [row] } = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM "user" WHERE "role" = 'ADMIN' AND "id" <> $1`, [id]);
  return row.n;
}

/** Changes a member's role. The last remaining ADMIN can never be demoted. Existing sessions are revoked so the change is immediate. */
export async function changeRole(id: string, role: TeamRole, actorId: string) {
  const db = await database();
  if (role === "STAFF" && !(await otherAdmins(db, id))) return "LAST_ADMIN" as const;
  if (id === actorId && role !== "ADMIN") return "SELF" as const;
  const { rows } = await db.query(`UPDATE "user" SET "role" = $2, "updatedAt" = now() WHERE "id" = $1 AND "role" IN ('STAFF', 'ADMIN') RETURNING "id"`, [id, role]);
  if (!rows.length) return "NOT_FOUND" as const;
  await db.query(`DELETE FROM "session" WHERE "userId" = $1`, [id]);
  return "OK" as const;
}

/** Removes staff access: the identity returns to CUSTOMER (it can no longer open a staff session) and its sessions end. */
export async function revokeMember(id: string, actorId: string) {
  const db = await database();
  if (id === actorId) return "SELF" as const;
  if (!(await otherAdmins(db, id))) {
    const { rows: [row] } = await db.query<{ role: string }>(`SELECT "role" FROM "user" WHERE "id" = $1`, [id]);
    if (row?.role === "ADMIN") return "LAST_ADMIN" as const;
  }
  const { rows } = await db.query(`UPDATE "user" SET "role" = 'CUSTOMER', "updatedAt" = now() WHERE "id" = $1 AND "role" IN ('STAFF', 'ADMIN') RETURNING "id"`, [id]);
  if (!rows.length) return "NOT_FOUND" as const;
  await db.query(`DELETE FROM "session" WHERE "userId" = $1`, [id]);
  return "OK" as const;
}

export async function resetMemberPassword(id: string, password: string) {
  const db = await database();
  const hash = await hashPassword(password);
  const { rows } = await db.query(`
    UPDATE "account" SET "password" = $2, "updatedAt" = now()
    WHERE "userId" = $1 AND "providerId" = 'credential' AND EXISTS (SELECT 1 FROM "user" WHERE "id" = $1 AND "role" IN ('STAFF', 'ADMIN')) RETURNING "id"`, [id, hash]);
  if (!rows.length) return false;
  await db.query(`DELETE FROM "session" WHERE "userId" = $1`, [id]);
  return true;
}
