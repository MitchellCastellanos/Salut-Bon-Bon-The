import { APIError, betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { postgresPool } from "./db";
import { sendAccountEmail } from "./account-email";

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

const runtime = globalThis as typeof globalThis & { salutStaffAuth?: ReturnType<typeof createAuth>; salutCustomerAuth?: ReturnType<typeof createCustomerAuth> };

export function staffAuth() {
  if (!staffAuthConfigured()) return undefined;
  return runtime.salutStaffAuth ??= createAuth();
}

/**
 * Customer accounts use a separate Better Auth instance and cookie prefix. It requires verified email,
 * and its session hook refuses STAFF and ADMIN identities, so staff never sign in as customers and
 * customers never obtain a staff session.
 */
function createCustomerAuth() {
  return betterAuth({
    database: postgresPool(),
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    advanced: { cookiePrefix: "salut-customer" },
    emailAndPassword: {
      enabled: true, disableSignUp: false, requireEmailVerification: true, autoSignIn: false,
      minPasswordLength: 12, maxPasswordLength: 128, resetPasswordTokenExpiresIn: 60 * 60, revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, token }) => { await sendAccountEmail("reset", user.email, user.name, token); },
    },
    emailVerification: {
      sendOnSignUp: true, autoSignInAfterVerification: false, expiresIn: 60 * 60,
      sendVerificationEmail: async ({ user, token }) => { await sendAccountEmail("verify", user.email, user.name, token); },
    },
    session: { expiresIn: 14 * 24 * 60 * 60, updateAge: 24 * 60 * 60, cookieCache: { enabled: false } },
    user: {
      additionalFields: {
        role: { type: ["CUSTOMER", "STAFF", "ADMIN"], required: true, defaultValue: "CUSTOMER", input: false },
      },
    },
    databaseHooks: {
      session: {
        create: {
          before: async session => {
            const { rows } = await postgresPool().query(`SELECT 1 FROM "user" WHERE "id" = $1 AND "role" = 'CUSTOMER'`, [session.userId]);
            if (!rows.length) throw new APIError("FORBIDDEN");
          },
        },
      },
    },
    plugins: [nextCookies()],
  });
}

export function customerAuth() {
  if (!staffAuthConfigured()) return undefined;
  return runtime.salutCustomerAuth ??= createCustomerAuth();
}
