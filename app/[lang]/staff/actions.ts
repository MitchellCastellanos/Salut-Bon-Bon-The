"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { language, states } from "../../../src/domain";
import { demoStaff, signInStaff, signOutStaff, staffRole } from "../../../src/staff";
import { recordPayment, updateOrder } from "../../../src/orders";
import { notifyOrder } from "../../../src/notifications";
import { earnForOrder } from "../../../src/loyalty";

export async function login(lang: string, form: FormData) {
  if (!language(lang)) return;
  const password = z.string().min(1).max(128).safeParse(form.get("password"));
  const email = z.email().max(254).safeParse(form.get("email")?.toString().trim().toLowerCase());
  let signedIn = false;
  if (password.success && (demoStaff() || email.success)) {
    try {
      signedIn = await signInStaff(email.data, password.data);
    } catch {
      // Use one localized error for credential and upstream failures.
    }
  }
  if (!signedIn) redirect(`/${lang}/staff?login=failed`);
  redirect(`/${lang}/staff`);
}
export async function logout(lang: string) {
  if (!language(lang)) return;
  await signOutStaff();
  redirect(`/${lang}/staff`);
}
export async function change(lang: string, form: FormData) {
  if (!language(lang) || !await staffRole()) return;
  const result = z.object({
    number: z.string().regex(/^[1-9]\d{0,17}$/),
    from: z.enum(states), to: z.enum([...states, "PAY"]),
  }).safeParse(Object.fromEntries(form));
  if (!result.success) return;
  const { number, from, to } = result.data;
  if (to === "PAY") await recordPayment(number);
  else if (await updateOrder(number, from, to)) {
    if (to === "READY") await notifyOrder(number, ["ready"]);
    if (to === "COMPLETED") await earnForOrder(number).catch(error => console.error("loyalty earn failed", { order: number, message: error instanceof Error ? error.message : "unknown" }));
    if (to === "CANCELLED") await notifyOrder(number, ["cancelled"]);
  }
  revalidatePath(`/${lang}/staff`);
}
