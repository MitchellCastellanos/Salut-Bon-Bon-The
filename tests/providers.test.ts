import Stripe from "stripe";
import { afterEach, expect, it, vi } from "vitest";
import { checkoutLineItems, stripeMode, verifyWebhook } from "../src/providers/stripe";

afterEach(() => vi.unstubAllEnvs());

function stubTest() {
  vi.stubEnv("DATABASE_URL", "postgresql://fixture.invalid/test");
  vi.stubEnv("SALUT_STRIPE_TEST_ENABLED", "1");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fixture");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_fixture");
}

it("verifies webhook signatures and refuses events from the wrong mode", () => {
  stubTest();
  const payload = (livemode: boolean) => JSON.stringify({ id: "evt_1", type: "checkout.session.completed", livemode, data: { object: {} } });
  const sign = (body: string) => new Stripe("sk_test_fixture").webhooks.generateTestHeaderString({ payload: body, secret: "whsec_fixture" });
  expect(verifyWebhook(payload(false), sign(payload(false))).id).toBe("evt_1");
  expect(() => verifyWebhook(payload(false), "invalid")).toThrow();
  expect(() => verifyWebhook(payload(true), sign(payload(true)))).toThrow("mode");
});

it("keeps test and live credentials strictly separate and live approval-gated", () => {
  stubTest();
  expect(stripeMode()).toBe("test");
  vi.stubEnv("STRIPE_MODE", "live");
  expect(stripeMode()).toBe("disabled");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_fixture");
  expect(stripeMode()).toBe("disabled");
  vi.stubEnv("SALUT_LIVE_PAYMENTS_APPROVED", "1");
  expect(stripeMode()).toBe("live");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fixture");
  expect(stripeMode()).toBe("disabled");
  vi.stubEnv("STRIPE_MODE", "");
  vi.stubEnv("SALUT_STRIPE_TEST_ENABLED", "");
  expect(stripeMode()).toBe("disabled");
});

it("builds Stripe line items that add up to the server-calculated order total", () => {
  const order = { number: "12", lang: "fr" as const, taxCents: 150, items: [
    { name: { fr: "Fraise", en: "Strawberry" }, quantity: 2, subtotal: 1300 },
    { name: { fr: "Taro", en: "Taro" }, quantity: 1, subtotal: 700 },
  ] };
  const total = checkoutLineItems(order).reduce((sum, line) => sum + line.price_data!.unit_amount! * line.quantity!, 0);
  expect(total).toBe(2150);
  expect(() => checkoutLineItems({ ...order, items: [{ ...order.items[0], subtotal: 1301 }] })).toThrow("whole cents");
});
