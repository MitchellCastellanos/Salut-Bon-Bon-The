"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { database } from "../../../../../src/db";
import { language } from "../../../../../src/domain";
import { notifyOrder } from "../../../../../src/notifications";
import { updateOrder } from "../../../../../src/orders";
import { RefundError, refundOrder } from "../../../../../src/refunds";
import { staffActor, staffRole } from "../../../../../src/staff";

const number = z.string().regex(/^[1-9]\d{0,17}$/);
const back = (lang: string, order: string, query: string): never => redirect(`/${lang}/admin/orders/${order}?${query}`);

export async function refund(lang: string, form: FormData) {
  if (!language(lang) || !process.env.DATABASE_URL || await staffRole() !== "ADMIN") throw new Error("Forbidden");
  const parsed = z.object({ order: number, amount: z.string().regex(/^\d{1,5}(\.\d{1,2})?$/), reason: z.string().trim().min(3).max(280), key: z.string().min(8).max(120) })
    .safeParse({ order: form.get("order"), amount: form.get("amount"), reason: form.get("reason"), key: form.get("key") });
  if (!parsed.success) return back(lang, String(form.get("order") ?? "").replace(/\D/g, "").slice(0, 18) || "0", "error=INVALID");
  const d = parsed.data;
  try {
    await refundOrder({ order: d.order, amountCents: Math.round(Number(d.amount) * 100), reason: d.reason, key: d.key, actor: await staffActor() });
  } catch (error) {
    if (error instanceof RefundError) return back(lang, d.order, `error=${error.code}`);
    throw error;
  }
  revalidatePath(`/${lang}/admin/orders/${d.order}`);
  return back(lang, d.order, "done=refund");
}

/** Cancels an active order with a reason (audited). A paid online order becomes "refund required" until it is refunded. */
export async function cancelOrder(lang: string, form: FormData) {
  if (!language(lang) || !process.env.DATABASE_URL || await staffRole() !== "ADMIN") throw new Error("Forbidden");
  const parsed = z.object({ order: number, from: z.enum(["RECEIVED", "CONFIRMED", "PREPARING", "READY"]), reason: z.string().trim().min(3).max(280) })
    .safeParse({ order: form.get("order"), from: form.get("from"), reason: form.get("reason") });
  if (!parsed.success) return back(lang, String(form.get("order") ?? "").replace(/\D/g, "").slice(0, 18) || "0", "error=INVALID");
  const d = parsed.data;
  // A stale page or a double click finds the order already moved on: say so instead of reporting a cancellation that did not happen.
  if (!await updateOrder(d.order, d.from, "CANCELLED")) return back(lang, d.order, "error=STATE");
  await (await database()).query("INSERT INTO catalog_audit_history (action, subject, details) VALUES ('order.cancel', $1, jsonb_build_object('reason', $2::text, 'actor', $3::text))", [d.order, d.reason, await staffActor()]);
  await notifyOrder(d.order, ["cancelled"]);
  revalidatePath(`/${lang}/admin/orders/${d.order}`);
  return back(lang, d.order, "done=cancel");
}
