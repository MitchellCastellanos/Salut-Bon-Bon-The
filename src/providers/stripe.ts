import Stripe from "stripe";

export type PaymentOrder = {
  number: string;
  lang: "fr" | "en";
  taxCents: number;
  items: { name: { fr: string; en: string }; quantity: number; subtotal: number }[];
};

/** Test mode is the default. Live mode needs a live key AND an explicit owner-approval flag. */
export function stripeMode(): "test" | "live" | "disabled" {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (!process.env.DATABASE_URL) return "disabled";
  if (process.env.STRIPE_MODE === "live") {
    return key.startsWith("sk_live_") && process.env.SALUT_LIVE_PAYMENTS_APPROVED === "1" ? "live" : "disabled";
  }
  return process.env.SALUT_STRIPE_TEST_ENABLED === "1" && key.startsWith("sk_test_") ? "test" : "disabled";
}

export function cardPaymentsEnabled() {
  return stripeMode() !== "disabled" && Boolean(process.env.STRIPE_WEBHOOK_SECRET);
}

function stripeClient() {
  if (stripeMode() === "disabled") throw new Error("Stripe is disabled for this environment");
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { maxNetworkRetries: 2 });
}

export function checkoutLineItems(order: PaymentOrder): Stripe.Checkout.SessionCreateParams.LineItem[] {
  const lines = order.items.map(item => {
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.subtotal % item.quantity !== 0) {
      throw new Error("Order line cannot be expressed in whole cents");
    }
    return {
      price_data: { currency: "cad", product_data: { name: item.name[order.lang] }, unit_amount: item.subtotal / item.quantity },
      quantity: item.quantity,
    };
  });
  if (order.taxCents > 0) {
    lines.push({
      price_data: { currency: "cad", product_data: { name: order.lang === "fr" ? "Taxes (TPS/TVQ)" : "Taxes (GST/QST)" }, unit_amount: order.taxCents },
      quantity: 1,
    });
  }
  return lines;
}

export async function createCheckout(order: PaymentOrder, siteUrl = process.env.SITE_URL ?? "") {
  if (!/^\d+$/.test(order.number)) throw new Error("Invalid checkout reference");
  const site = new URL(siteUrl);
  if (site.protocol !== "https:" && !["127.0.0.1", "localhost"].includes(site.hostname)) {
    throw new Error("Configure the site's HTTPS origin");
  }
  const session = await stripeClient().checkout.sessions.create({
    mode: "payment",
    locale: order.lang,
    client_reference_id: order.number,
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    success_url: new URL(`/${order.lang}?payment=returned`, site).href,
    cancel_url: new URL(`/${order.lang}/menu`, site).href,
    line_items: checkoutLineItems(order),
  }, { idempotencyKey: `salut-checkout:${order.number}` });
  return { id: session.id, url: session.url, cents: session.amount_total ?? 0 };
}

export function verifyWebhook(payload: string, signature: string) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("Configure the Stripe webhook secret");
  const event = stripeClient().webhooks.constructEvent(payload, signature, secret);
  if (event.livemode !== (stripeMode() === "live")) throw new Error("Stripe event mode does not match this environment");
  return event;
}
