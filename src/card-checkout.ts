import { randomBytes } from "node:crypto";
import { database } from "./db";
import { abandonUnpaidOrder, openCheckoutUrl, recordCheckoutSession } from "./payments";
import { createCheckout, simulatedPayments, type PaymentOrder } from "./providers/stripe";

/**
 * Returns the hosted checkout URL for a card order, creating the session at most once. In demo mode without Stripe credentials this
 * is the simulated payment page (`/{lang}/pay/<session>`), otherwise Stripe Checkout. The amount always comes from the stored,
 * server-priced order. On failure the order is cancelled so its pickup slot is released.
 */
export async function cardCheckoutUrl(number: string): Promise<string | null> {
  const existing = await openCheckoutUrl(number);
  if (existing) return existing;
  const db = await database();
  const { rows: [order] } = await db.query<{ locale: "fr" | "en"; total: number; tax_cents: number; items: PaymentOrder["items"]; tracking_token: string }>(
    "SELECT locale, total, tax_cents, items, tracking_token FROM orders WHERE number = $1 AND payment_method = 'card' AND status = 'RECEIVED' AND payment = 'UNPAID'", [number]);
  if (!order) return null;
  try {
    if (simulatedPayments()) {
      const id = `sim_cs_${randomBytes(16).toString("hex")}`;
      const url = `/${order.locale}/pay/${id}`;
      await recordCheckoutSession({ order: number, sessionId: id, url, cents: order.total, provider: "simulated" });
      return url;
    }
    const session = await createCheckout({ number, lang: order.locale, taxCents: order.tax_cents, items: order.items, trackingToken: order.tracking_token });
    if (!session.url || session.cents !== order.total) throw new Error("Stripe total does not match the order total");
    await recordCheckoutSession({ order: number, sessionId: session.id, url: session.url, cents: order.total });
    return session.url;
  } catch (error) {
    console.error("card checkout failed", { order: number, message: error instanceof Error ? error.message : "unknown" });
    await abandonUnpaidOrder(number);
    return null;
  }
}
