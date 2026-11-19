import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { staffAuth } from "./auth";

const demoCookie = "salut-staff-demo";
const demoPassword = "salut-demo";
const demoLifetime = 8 * 60 * 60;
const runtime = globalThis as typeof globalThis & { salutDemoSessionKey?: string };

export const demoStaff = () => !process.env.DATABASE_URL && !process.env.BETTER_AUTH_SECRET && !process.env.BETTER_AUTH_URL &&
  !process.env.STAFF_PASSWORD && !process.env.SESSION_SECRET;
export type StaffRole = "STAFF" | "ADMIN";

export function canManageOrders(role: unknown): role is StaffRole {
  return role === "STAFF" || role === "ADMIN";
}

function demoDigest(expiry: string) {
  const key = runtime.salutDemoSessionKey ??= randomBytes(32).toString("hex");
  return createHmac("sha256", key).update(expiry).digest("hex");
}

export async function signInStaff(email: string | undefined, password: string) {
  if (demoStaff()) {
    if (password !== demoPassword) return false;
    const expiry = String(Date.now() + demoLifetime * 1000);
    (await cookies()).set(demoCookie, expiry + "." + demoDigest(expiry), {
      httpOnly: true, sameSite: "strict", maxAge: demoLifetime, path: "/",
    });
    return true;
  }
  const auth = staffAuth();
  if (!auth || !email) return false;
  await auth.api.signInEmail({ body: { email, password, rememberMe: false }, headers: await headers() });
  return true;
}

export async function signOutStaff() {
  if (demoStaff()) {
    (await cookies()).delete(demoCookie);
    return;
  }
  const auth = staffAuth();
  if (auth) await auth.api.signOut({ headers: await headers() });
}

export async function staffRole(): Promise<StaffRole | undefined> {
  if (demoStaff()) {
    const raw = (await cookies()).get(demoCookie)?.value;
    const [expiry, digest] = raw?.split(".") ?? [];
    if (!/^\d+$/.test(expiry) || Number(expiry) <= Date.now() || !/^[a-f0-9]{64}$/.test(digest)) return;
    if (timingSafeEqual(Buffer.from(digest, "hex"), Buffer.from(demoDigest(expiry), "hex"))) return "STAFF";
    return;
  }
  const auth = staffAuth();
  const session = await auth?.api.getSession({ headers: await headers() });
  return canManageOrders(session?.user.role) ? session.user.role : undefined;
}

/** Stable identifier of the signed-in staff member, recorded as the actor on loyalty and audit entries. */
export async function staffActor(): Promise<string> {
  if (demoStaff()) return "demo-staff";
  const session = await staffAuth()?.api.getSession({ headers: await headers() });
  return session?.user.id ?? "unknown";
}

/** Display identity of the signed-in staff member, shown in the console sidebar. */
export async function staffProfile(): Promise<{ name: string; email?: string } | undefined> {
  if (demoStaff()) return await staffRole() ? { name: "Demo" } : undefined;
  const session = await staffAuth()?.api.getSession({ headers: await headers() });
  return session && canManageOrders(session.user.role) ? { name: session.user.name, email: session.user.email } : undefined;
}
