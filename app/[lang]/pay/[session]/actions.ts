"use server";
import { redirect } from "next/navigation";
import { language } from "../../../../src/domain";
import { notifyOrder } from "../../../../src/notifications";
import { applySimulatedPayment, simulatedAttempt } from "../../../../src/payments";
import { simulatedPayments } from "../../../../src/providers/stripe";

/** Completes or abandons a simulated checkout. No card data exists: the page shows a fixed test card and nothing is charged. */
export async function finishSimulatedPayment(lang: string, session: string, form: FormData) {
  if (!language(lang) || !simulatedPayments()) return;
  const attempt = await simulatedAttempt(session);
  if (!attempt) return;
  const paid = form.get("result") === "pay";
  const result = await applySimulatedPayment(session, paid ? "paid" : "failed");
  if (result.outcome === "paid") await notifyOrder(result.order, ["customer_confirmation", "store_notification"]);
  redirect(`/${attempt.lang}/track/${attempt.token}${paid ? "?payment=returned" : "?payment=cancelled"}`);
}
