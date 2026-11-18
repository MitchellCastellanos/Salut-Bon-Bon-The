import type Stripe from "stripe";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { applyStripeEvent, recordCheckoutSession } from "../src/payments";
import { deliverPendingEmails, emailMode, enqueueOrderEmails, orderEmail } from "../src/notifications";
import { updateOrder } from "../src/orders";

const local = vi.hoisted(() => ({ current: undefined as PGlite | undefined }));
vi.mock("../src/db", async () => {
  local.current = new PGlite();
  await (await vi.importActual<typeof import("../src/db")>("../src/db")).applyLocalMigrations(local.current);
  return { database: async () => local.current };
});
afterAll(async () => local.current?.close());
beforeEach(() => vi.unstubAllEnvs());

let counter = 0;
const q = async (sql: string, args: unknown[] = []) => (await local.current!.query<Record<string, unknown>>(sql, args)).rows;
async function order(method: "pickup" | "card" = "card", email: string | null = "guest@example.invalid") {
  counter++;
  const [row] = await q(`INSERT INTO orders (request_id, request_fingerprint, tracking_token, locale, customer, notes, pickup_at, items, total, payment, tax_cents, customer_email, payment_method)
    VALUES (gen_random_uuid(), 'f', $1, 'fr', 'Test <b>Guest</b>', '', now() + interval '1 hour',
      '[{"name":{"fr":"Fraise","en":"Strawberry"},"quantity":1,"subtotal":1000}]', 1150, 'UNPAID', 150, $2, $3) RETURNING number::text AS number`,
    [String(counter).padStart(64, "a"), email, method]);
  const session = `cs_test_${counter}`;
  await recordCheckoutSession({ order: row.number as string, sessionId: session, url: "https://checkout.stripe.test/x", cents: 1150 });
  return { number: row.number as string, session };
}
const event = (id: string, type: string, object: Partial<Stripe.Checkout.Session>, livemode = false) =>
  ({ id, type, livemode, data: { object: { mode: "payment", currency: "cad", amount_total: 1150, payment_status: "paid", ...object } } }) as unknown as Stripe.Event;
const state = async (number: string) => (await q("SELECT status, payment FROM orders WHERE number = $1", [number]))[0];

describe("Stripe reconciliation", () => {
  it("settles a paid session once and ignores replays", async () => {
    const o = await order();
    const e = event("evt_paid_1", "checkout.session.completed", { id: o.session, client_reference_id: o.number });
    expect(await applyStripeEvent(e)).toEqual({ outcome: "paid", order: o.number, payment: "PAID_ONLINE" });
    expect(await applyStripeEvent(e)).toEqual({ outcome: "replay" });
    expect(await state(o.number)).toMatchObject({ payment: "PAID_ONLINE" });
    expect(await q("SELECT 1 FROM provider_events WHERE event_id = 'evt_paid_1'")).toHaveLength(1);
  });
  it("never trusts a mismatched amount or reference", async () => {
    const wrongAmount = await order();
    expect(await applyStripeEvent(event("evt_m1", "checkout.session.completed", { id: wrongAmount.session, client_reference_id: wrongAmount.number, amount_total: 100 })))
      .toEqual({ outcome: "mismatch", order: wrongAmount.number });
    expect(await state(wrongAmount.number)).toMatchObject({ payment: "UNPAID" });
    const wrongRef = await order();
    expect((await applyStripeEvent(event("evt_m2", "checkout.session.completed", { id: wrongRef.session, client_reference_id: "999999" }))).outcome).toBe("mismatch");
    expect(await state(wrongRef.number)).toMatchObject({ payment: "UNPAID" });
  });
  it("does not settle unpaid delayed-payment sessions or live events in test mode", async () => {
    const o = await order();
    expect((await applyStripeEvent(event("evt_u", "checkout.session.completed", { id: o.session, client_reference_id: o.number, payment_status: "unpaid" }))).outcome).toBe("ignored");
    expect((await applyStripeEvent(event("evt_l", "checkout.session.completed", { id: o.session, client_reference_id: o.number }, true))).outcome).toBe("ignored");
    expect(await state(o.number)).toMatchObject({ payment: "UNPAID" });
  });
  it("releases the pickup slot when a session expires", async () => {
    const o = await order();
    expect((await applyStripeEvent(event("evt_x", "checkout.session.expired", { id: o.session, payment_status: "unpaid" }))).outcome).toBe("failed");
    expect(await state(o.number)).toEqual({ status: "CANCELLED", payment: "PAYMENT_FAILED" });
    expect(await q("SELECT 1 FROM order_events WHERE order_number = $1 AND status = 'CANCELLED'", [o.number])).toHaveLength(1);
  });
  it("flags a refund when payment arrives for an already cancelled order", async () => {
    const o = await order();
    await q("UPDATE orders SET status = 'CANCELLED' WHERE number = $1", [o.number]);
    expect(await applyStripeEvent(event("evt_r", "checkout.session.completed", { id: o.session, client_reference_id: o.number })))
      .toEqual({ outcome: "paid", order: o.number, payment: "REFUND_REQUIRED" });
  });
  it("asks Stripe to retry events that beat the ledger row, then applies them", async () => {
    counter++;
    const e = event("evt_early", "checkout.session.completed", { id: "cs_test_early", client_reference_id: "1" });
    expect(await applyStripeEvent(e)).toEqual({ outcome: "unknown" });
    expect(await q("SELECT 1 FROM provider_events WHERE event_id = 'evt_early'")).toHaveLength(0);
  });
});

describe("card order lifecycle", () => {
  it("blocks confirmation until paid, then flags refunds on cancellation", async () => {
    const o = await order();
    expect(await updateOrder(o.number, "RECEIVED", "CONFIRMED")).toBe(false);
    await applyStripeEvent(event("evt_life", "checkout.session.completed", { id: o.session, client_reference_id: o.number }));
    expect(await updateOrder(o.number, "RECEIVED", "CONFIRMED")).toBe(true);
    expect(await updateOrder(o.number, "CONFIRMED", "CANCELLED")).toBe(true);
    expect(await state(o.number)).toEqual({ status: "CANCELLED", payment: "REFUND_REQUIRED" });
  });
  it("never completes an order that was not paid", async () => {
    const o = await order("pickup");
    for (const [from, to] of [["RECEIVED", "CONFIRMED"], ["CONFIRMED", "PREPARING"], ["PREPARING", "READY"]] as const) await updateOrder(o.number, from, to);
    expect(await updateOrder(o.number, "READY", "COMPLETED")).toBe(false);
  });
});

describe("transactional email", () => {
  const stub = () => {
    vi.stubEnv("DATABASE_URL", "postgresql://fixture.invalid/test");
    vi.stubEnv("RESEND_API_KEY", "re_fixture");
    vi.stubEnv("RESEND_FROM", "Salut <orders@example.invalid>");
    vi.stubEnv("SALUT_RESEND_TEST_ENABLED", "1");
    vi.stubEnv("RESEND_TEST_RECIPIENT", "qa@example.invalid");
    vi.stubEnv("STORE_NOTIFICATION_EMAIL", "qa@example.invalid");
  };
  it("renders escaped, bilingual, branded messages", async () => {
    const o = await order("pickup");
    const [row] = await q("SELECT number::text AS number, customer, locale, pickup_at, total, tax_cents, payment, tracking_token, items FROM orders WHERE number = $1", [o.number]);
    const fr = orderEmail("ready", row as never, "fr", "https://example.invalid");
    expect(fr.subject).toContain("prête pour la cueillette");
    const store = orderEmail("store_notification", row as never, "en", "https://example.invalid");
    expect(store.html).not.toContain("<b>Guest</b>");
    expect(store.html).toContain("&lt;b&gt;Guest&lt;/b&gt;");
    expect(store.html).toContain("#F45143");
    expect(orderEmail("customer_confirmation", row as never, "en", "https://example.invalid").html).toContain("/en/track/");
  });
  it("sends nothing without explicit configuration", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://fixture.invalid/test");
    expect(emailMode()).toBe("disabled");
    const fetchImpl = vi.fn();
    expect(await deliverPendingEmails({ fetchImpl })).toEqual({ sent: 0, skipped: 0, failed: 0 });
    expect(fetchImpl).not.toHaveBeenCalled();
    vi.stubEnv("RESEND_MODE", "live");
    vi.stubEnv("RESEND_API_KEY", "re_x"); vi.stubEnv("RESEND_FROM", "a@example.invalid");
    expect(emailMode()).toBe("disabled");
  });
  it("in test mode only reaches the test recipient, with idempotency keys, retrying failures", async () => {
    stub();
    await q("DELETE FROM email_outbox");
    const stranger = await order("pickup", "real.customer@example.invalid");
    const mine = await order("pickup", "qa@example.invalid");
    await enqueueOrderEmails(stranger.number, ["customer_confirmation"]);
    await enqueueOrderEmails(mine.number, ["customer_confirmation", "store_notification"]);
    await enqueueOrderEmails(mine.number, ["customer_confirmation"]); // duplicate enqueue is a no-op
    expect(await q("SELECT 1 FROM email_outbox")).toHaveLength(3);
    const calls: { to: string[]; key: string }[] = [];
    let fail = true;
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      calls.push({ to: body.to, key: (init?.headers as Record<string, string>)["Idempotency-Key"] });
      return new Response("{}", { status: fail ? 500 : 200 });
    }) as unknown as typeof fetch;
    expect(await deliverPendingEmails({ fetchImpl })).toEqual({ sent: 0, skipped: 1, failed: 2 });
    fail = false;
    expect(await deliverPendingEmails({ fetchImpl })).toEqual({ sent: 2, skipped: 0, failed: 0 });
    expect(calls.every(call => call.to[0] === "qa@example.invalid")).toBe(true);
    expect(new Set(calls.map(call => call.key)).size).toBe(2);
    expect(await q("SELECT status FROM email_outbox WHERE order_number = $1", [stranger.number])).toEqual([{ status: "SKIPPED" }]);
  });
});
