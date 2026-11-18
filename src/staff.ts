import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const cookieName = "salut-staff";
export const demoStaff = () => !process.env.DATABASE_URL && !process.env.STAFF_PASSWORD && !process.env.SESSION_SECRET;
const runtime = globalThis as typeof globalThis & { salutDemoSessionKey?: string };
const secret = () => demoStaff()
  ? (runtime.salutDemoSessionKey ??= randomBytes(32).toString("hex"))
  : process.env.SESSION_SECRET;
function same(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function session(password: string) {
  const expected = demoStaff() ? "salut-demo" : process.env.STAFF_PASSWORD;
  const key = secret();
  if (!key || !expected || (!demoStaff() && (key.length < 32 || expected.length < 12)) || !same(password, expected)) return;
  const expiry = (Date.now() + 8 * 3600000).toString();
  return expiry + "." + createHmac("sha256", key).update(expiry).digest("hex");
}
export async function isStaff() {
  const raw = (await cookies()).get(cookieName)?.value;
  const key = secret();
  if (!raw || !key || (!demoStaff() && (key.length < 32 || (process.env.STAFF_PASSWORD?.length ?? 0) < 12))) return false;
  const [expiry, digest] = raw.split(".");
  return /^\d+$/.test(expiry) && Number(expiry) > Date.now() && !!digest &&
    same(digest, createHmac("sha256", key).update(expiry).digest("hex"));
}
