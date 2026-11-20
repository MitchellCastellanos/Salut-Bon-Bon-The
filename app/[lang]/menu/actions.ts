"use server";
import { after } from "next/server";
import { z } from "zod";
import { analyticsAllowed, campaignIds } from "../../../src/analytics";
import { commercialPickupSlots } from "../../../src/store-settings";
import { checkoutSchema, pickupSlots } from "../../../src/domain";
import { demoStorageAllowed } from "../../../src/db";
import { customerSession } from "../../../src/customer";
import { placeOrder } from "../../../src/orders";
import { cardCheckoutUrl } from "../../../src/card-checkout";
import { cardPaymentsEnabled } from "../../../src/providers/stripe";
import { notifyOrder } from "../../../src/notifications";
import { currentGuestCard } from "../../../src/guest-card";
import { linkOrderToCard } from "../../../src/loyalty";

export async function slots() {
  // Deployed environments never offer demo slots without a database.
  if (!process.env.DATABASE_URL) return demoStorageAllowed() ? pickupSlots() : [];
  return commercialPickupSlots();
}
export async function submitOrder(payload: unknown, campaign?: unknown) {
  const parsed = checkoutSchema.safeParse(payload);
  if (!parsed.success) return { error: "INVALID" } as const;
  if (process.env.DATABASE_URL && parsed.data.method === "demo") return { error: "METHOD" } as const;
  if (parsed.data.method === "card" && !cardPaymentsEnabled()) return { error: "PAYMENT" } as const;
  try {
    const allowed = await analyticsAllowed();
    const attribution = z.enum(campaignIds).safeParse(campaign);
    const customer = process.env.DATABASE_URL ? await customerSession().catch(() => undefined) : undefined;
    // A signed-in customer gets order history, loyalty earning and notices at their account email.
    const order = await placeOrder({ ...parsed.data, email: parsed.data.email ?? customer?.email },
      allowed ? { campaign: attribution.success ? attribution.data : null } : undefined, customer?.id);
    const number = order.number.toString();
    // A guest card held by this browser collects stamps for the order (never for another person's card or a signed-in member's order).
    if (process.env.DATABASE_URL && !customer) {
      const card = await currentGuestCard().catch(() => undefined);
      if (card) await linkOrderToCard(number, card.account.id).catch(() => undefined);
    }
    if (parsed.data.method === "card") {
      const redirect = await cardCheckoutUrl(number);
      if (!redirect) return { error: "PAYMENT" } as const;
      return { number, token: order.tracking_token, redirect } as const;
    }
    // Pickup orders are confirmed now. Card orders are confirmed only once Stripe settles them.
    if (parsed.data.method === "pickup") after(() => notifyOrder(number, ["customer_confirmation", "store_notification"]));
    return { number, token: order.tracking_token } as const;
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return { error: ["SLOT", "MENU", "CONFLICT", "RATE", "PRICE", "PAYMENT"].includes(code) ? code : "FAILED" } as const;
  }
}
