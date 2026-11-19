"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { language } from "../../../../src/domain";
import { CounterError, counterSchema, placeCounterOrder } from "../../../../src/counter";
import { allow } from "../../../../src/rate-limit";
import { staffActor, staffRole } from "../../../../src/staff";

export async function submitCounterOrder(lang: string, form: FormData) {
  if (!language(lang) || !process.env.DATABASE_URL || !await staffRole()) return;
  const back = (query: string): never => redirect(`/${lang}/staff/counter?${query}`);
  let lines: unknown;
  try { lines = JSON.parse(String(form.get("lines") ?? "[]")); } catch { back("error=invalid"); }
  const parsed = counterSchema.safeParse({
    request: form.get("request"), name: String(form.get("name") ?? ""), tender: form.get("tender"),
    member: String(form.get("member") ?? ""), lines,
  });
  if (!parsed.success) back("error=invalid");
  const actor = await staffActor();
  if (!await allow("counter-staff", actor, 60, 60)) back("error=rate");
  let result;
  try {
    result = await placeCounterOrder(parsed.data!, actor);
  } catch (error) {
    if (error instanceof CounterError) back(`error=${error.code.toLowerCase()}`);
    throw error;
  }
  revalidatePath(`/${lang}/staff`);
  back(`done=${result.number}&total=${result.total ?? 0}&points=${result.awarded}`);
}

