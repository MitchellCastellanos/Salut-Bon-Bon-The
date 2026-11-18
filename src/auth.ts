import { APIError, betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { postgresPool } from "./db";

export function staffAuthConfigured() {
  const { DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL } = process.env;
  if (!DATABASE_URL || !BETTER_AUTH_SECRET || BETTER_AUTH_SECRET.length < 32 || !BETTER_AUTH_URL) return false;
  try {
    const url = new URL(BETTER_AUTH_URL);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    return url.origin === BETTER_AUTH_URL.replace(/\/$/, "") &&
      (url.protocol === "https:" || (url.protocol === "http:" && local));
  } catch {
    return false;
  }
}

function createAuth() {
  return betterAuth({
    database: postgresPool(),
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 12, maxPasswordLength: 128 },
    session: { expiresIn: 8 * 60 * 60, disableSessionRefresh: true, cookieCache: { enabled: false } },
    user: {
      additionalFields: {
        role: { type: ["CUSTOMER", "STAFF", "ADMIN"], required: true, defaultValue: "CUSTOMER", input: false },
      },
    },
    databaseHooks: {
      session: {
        create: {
          before: async session => {
            const { rows } = await postgresPool().query(
              `SELECT 1 FROM "user" WHERE "id" = $1 AND "role" IN ('STAFF', 'ADMIN')`, [session.userId]
            );
            if (!rows.length) throw new APIError("FORBIDDEN");
          },
        },
      },
    },
    plugins: [nextCookies()],
  });
}

const runtime = globalThis as typeof globalThis & { salutStaffAuth?: ReturnType<typeof createAuth> };

export function staffAuth() {
  if (!staffAuthConfigured()) return undefined;
  return runtime.salutStaffAuth ??= createAuth();
}
