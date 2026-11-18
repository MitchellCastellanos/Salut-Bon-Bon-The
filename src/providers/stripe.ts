import Stripe from "stripe";

type PaymentOrder = {
  number: string;
  cents: number;
};

function stripeTestClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!process.env.DATABASE_URL || process.env.SALUT_STRIPE_TEST_ENABLED !== "1" || !key?.startsWith("sk_test_")) {
    throw new Error("Stripe test integration is disabled");
  }
  return new Stripe(key, { maxNetworkRetries: 2 });
}

export async function createTestCheckout(order: PaymentOrder, attempt: string, lang: "fr" | "en") {
  if (!/^\d+$/.test(order.number) || !Number.isSafeInteger(order.cents) || order.cents <= 0 ||
      !/^[a-z0-9-]{1,64}$/i.test(attempt)) throw new Error("Invalid checkout reference");
  const site = new URL(process.env.SITE_URL ?? "");
  if (site.protocol !== "https:" && !["127.0.0.1", "localhost"].includes(site.hostname)) {
    throw new Error("Configure the test site's HTTPS origin");
  }
  return stripeTestClient().checkout.sessions.create({
    mode: "payment",
    locale: lang,
    client_reference_id: order.number,
    success_url: new URL(`/${lang}?payment=returned`, site).href,
    cancel_url: new URL(`/${lang}/menu`, site).href,
    line_items: [{
      price_data: { currency: "cad", product_data: { name: "Salut Bon Bon Thé" }, unit_amount: order.cents },
      quantity: 1,
    }],
  }, { idempotencyKey: `salut-test-checkout:${order.number}:${attempt}` });
}

export function verifyTestWebhook(payload: string, signature: string) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("Configure the Stripe test webhook secret");
  const event = stripeTestClient().webhooks.constructEvent(payload, signature, secret);
  if (event.livemode) throw new Error("Live Stripe events are disabled");
  return event;
}

export function matchesPaidCheckout(event: Stripe.Event, order: PaymentOrder & { sessionId: string }) {
  if (event.livemode || (event.type !== "checkout.session.completed" &&
      event.type !== "checkout.session.async_payment_succeeded")) return false;
  const session = event.data.object;
  return session.id === order.sessionId && session.mode === "payment" &&
    session.client_reference_id === order.number && session.currency === "cad" &&
    session.amount_total === order.cents && session.payment_status === "paid";
}
