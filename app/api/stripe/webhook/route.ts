import { applyStripeEvent } from "../../../../src/payments";
import { notifyOrder } from "../../../../src/notifications";
import { verifyWebhook } from "../../../../src/providers/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const length = Number(request.headers.get("content-length") ?? "0");
  if (!signature || length > 1_000_000) return new Response("Bad request", { status: 400 });
  const payload = await request.text();
  if (payload.length > 1_000_000) return new Response("Bad request", { status: 400 });
  let event;
  try {
    event = verifyWebhook(payload, signature);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  try {
    const result = await applyStripeEvent(event);
    if (result.outcome === "unknown") return new Response("Retry later", { status: 503 });
    if (result.outcome === "mismatch") console.error("stripe amount mismatch", { order: result.order, event: event.id });
    if (result.outcome === "paid") await notifyOrder(result.order, ["customer_confirmation", "store_notification"]);
    return Response.json({ received: true, outcome: result.outcome });
  } catch (error) {
    console.error("stripe webhook failed", { event: event.id, message: error instanceof Error ? error.message : "unknown" });
    return new Response("Processing failed", { status: 500 });
  }
}
