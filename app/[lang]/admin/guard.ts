import { notFound } from "next/navigation";
import { language, type Lang } from "../../../src/domain";
import { staffActor, staffRole } from "../../../src/staff";

/** Admin pages: ADMIN only, resolved from the database on every request. Anyone else gets a 404, so the screen is not even revealed. */
export async function adminPage(lang: string): Promise<Lang> {
  if (!language(lang) || !process.env.DATABASE_URL || await staffRole() !== "ADMIN") notFound();
  return lang as Lang;
}

/** Admin server actions: same rule, enforced again on the server for every submission. Returns the audit actor. */
export async function adminAction(): Promise<string> {
  if (!process.env.DATABASE_URL || await staffRole() !== "ADMIN") throw new Error("Forbidden");
  return staffActor();
}

export const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
export const flag = (form: FormData, key: string) => form.get(key) === "on";
