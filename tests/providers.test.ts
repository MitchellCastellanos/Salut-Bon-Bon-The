import Stripe from "stripe";
import { afterEach, expect, it, vi } from "vitest";
import { orderNotice, sendResendTestNotice } from "../src/providers/order-notices";
import { matchesPaidCheckout, verifyTestWebhook } from "../src/providers/stripe";

afterEach(() => vi.unstubAllEnvs());

it("accepts a signed test checkout only when its paid total and reference match", () => {
  const secret = "whsec_fixture";
  vi.stubEnv("DATABASE_URL", "postgresql://fixture.invalid/test");
  vi.stubEnv("SALUT_STRIPE_TEST_ENABLED", "1");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fixture");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", secret);
  const payload = JSON.stringify({
    type: "checkout.session.completed",
    livemode: false,
    data: { object: {
      id: "cs_test_fixture", mode: "payment", client_reference_id: "12", currency: "cad",
      amount_total: 700, payment_status: "paid",
    } },
  });
  const stripe = new Stripe("sk_test_fixture");
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
  const event = verifyTestWebhook(payload, signature);
  expect(matchesPaidCheckout(event, { number: "12", sessionId: "cs_test_fixture", cents: 700 })).toBe(true);
  expect(matchesPaidCheckout(event, { number: "12", sessionId: "cs_test_fixture", cents: 701 })).toBe(false);
  expect(() => verifyTestWebhook(payload, "invalid")).toThrow();
});

it("formats bilingual notices and refuses to send in a credential-free demo", async () => {
  vi.stubEnv("DATABASE_URL", "");
  expect(orderNotice("fr", "ready", "12").subject).toContain("prête pour la cueillette");
  expect(orderNotice("en", "confirmed", "12").subject).toBe("Order #12 confirmed");
  await expect(sendResendTestNotice({
    to: "nobody@example.invalid", lang: "fr", notice: "ready", number: "12", idempotencyKey: "fixture-12-ready",
  })).rejects.toThrow("disabled");
});
