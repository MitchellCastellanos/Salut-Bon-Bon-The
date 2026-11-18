import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { hashPassword } from "better-auth/crypto";
import pg from "pg";
import { z } from "zod";

const input = z.object({
  role: z.enum(["STAFF", "ADMIN"]),
  email: z.email().max(254),
  name: z.string().trim().min(1).max(80),
}).safeParse({
  role: process.argv[2], email: process.argv[3]?.trim().toLowerCase(), name: process.argv[4],
});

async function createStaff() {
  if (!input.success || !process.env.DATABASE_URL || process.stdin.isTTY) {
    throw new Error("Set DATABASE_URL and pipe the password on stdin. Usage: npm run staff:create -- STAFF|ADMIN email name");
  }
  const password = readFileSync(0, "utf8").replace(/\r?\n$/, "");
  if (password.length < 12 || password.length > 128) throw new Error("Password must be 12–128 characters.");
  const hash = await hashPassword(password);
  const { role, email, name } = input.data;
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const id = randomUUID();
  try {
    await pool.query(`
      WITH created AS (
        INSERT INTO "user" ("id", "name", "email", "role", "emailVerified")
        VALUES ($1, $2, $3, $4, true)
        RETURNING "id"
      )
      INSERT INTO "account" ("id", "accountId", "providerId", "userId", "password", "updatedAt")
      SELECT $5, "id", 'credential', "id", $6, CURRENT_TIMESTAMP FROM created
    `, [id, name, email, role, randomUUID(), hash]);
    console.log(`Created ${role} account.`);
  } catch (error) {
    throw new Error(error?.code === "23505"
      ? "An account with this email already exists."
      : "Could not create staff account. Check the database connection and migration 002.");
  } finally {
    await pool.end();
  }
}

try {
  await createStaff();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Staff provisioning failed.");
  process.exitCode = 1;
}
