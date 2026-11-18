"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { language, states } from "../../../src/domain";
import { cookieName, demoStaff, isStaff, session } from "../../../src/staff";
import { recordPayment, updateOrder } from "../../../src/orders";

export async function login(lang: string, form: FormData) {
  if (!language(lang)) return;
  const password = z.string().max(256).safeParse(form.get("password"));
  const value = password.success ? session(password.data) : undefined;
  if (!value) redirect(`/${lang}/staff?login=failed`);
  (await cookies()).set(cookieName, value, { httpOnly: true, sameSite: "strict", secure: !demoStaff() && process.env.NODE_ENV === "production", maxAge: 8 * 3600, path: "/" });
  redirect(`/${lang}/staff`);
}
export async function logout(lang: string) {
  if (!language(lang)) return;
  (await cookies()).delete(cookieName);
  redirect(`/${lang}/staff`);
}
export async function change(lang: string, form: FormData) {
  if (!language(lang) || !await isStaff()) return;
  const result = z.object({
    number: z.string().regex(/^[1-9]\d{0,17}$/),
    from: z.enum(states), to: z.enum([...states, "PAY"]),
  }).safeParse(Object.fromEntries(form));
  if (!result.success) return;
  const { number, from, to } = result.data;
  if (to === "PAY") await recordPayment(number);
  else await updateOrder(number, from, to);
  revalidatePath(`/${lang}/staff`);
}
