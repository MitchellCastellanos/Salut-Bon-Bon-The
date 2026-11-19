"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { database } from "../../../../src/db";
import { language } from "../../../../src/domain";
import { staffActor, staffRole } from "../../../../src/staff";
import { changeRole, createMember, newMember, resetMemberPassword, revokeMember } from "../../../../src/team";

async function admin() {
  if (!process.env.DATABASE_URL || await staffRole() !== "ADMIN") throw new Error("Forbidden");
  return staffActor();
}
const back = (lang: string, query: string): never => redirect(`/${lang}/admin/team?${query}`);
async function audit(action: string, subject: string, actor: string) {
  await (await database()).query(`INSERT INTO catalog_audit_history (action, subject, details) VALUES ($1, $2, jsonb_build_object('actor', $3::text))`, [action, subject, actor]);
}
const id = z.string().min(1).max(64);

export async function addMember(lang: string, form: FormData) {
  const actor = await admin();
  if (!language(lang)) return;
  const parsed = newMember.safeParse(Object.fromEntries(form));
  if (!parsed.success) back(lang, "error=invalid");
  if (!await createMember(parsed.data!)) back(lang, "error=exists");
  await audit("team.create", `${parsed.data!.role}:${parsed.data!.email}`, actor);
  back(lang, "saved=created");
}

export async function setRole(lang: string, form: FormData) {
  const actor = await admin();
  if (!language(lang)) return;
  const parsed = z.object({ id, role: z.enum(["STAFF", "ADMIN"]) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) back(lang, "error=invalid");
  const result = await changeRole(parsed.data!.id, parsed.data!.role, actor);
  if (result !== "OK") back(lang, `error=${result.toLowerCase()}`);
  await audit("team.role", `${parsed.data!.id}:${parsed.data!.role}`, actor);
  back(lang, "saved=role");
}

export async function removeMember(lang: string, form: FormData) {
  const actor = await admin();
  if (!language(lang)) return;
  const parsed = z.object({ id }).safeParse(Object.fromEntries(form));
  if (!parsed.success) back(lang, "error=invalid");
  const result = await revokeMember(parsed.data!.id, actor);
  if (result !== "OK") back(lang, `error=${result.toLowerCase()}`);
  await audit("team.revoke", parsed.data!.id, actor);
  back(lang, "saved=revoked");
}

export async function resetPassword(lang: string, form: FormData) {
  const actor = await admin();
  if (!language(lang)) return;
  const parsed = z.object({ id, password: z.string().min(12).max(128) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) back(lang, "error=invalid");
  if (!await resetMemberPassword(parsed.data!.id, parsed.data!.password)) back(lang, "error=not_found");
  await audit("team.password", parsed.data!.id, actor);
  back(lang, "saved=password");
}
