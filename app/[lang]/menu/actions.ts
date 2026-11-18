"use server";
import { z } from "zod";
import { analyticsAllowed, campaignIds } from "../../../src/analytics";
import { commercialPickupSlots } from "../../../src/store-settings";
import { checkoutSchema, pickupSlots } from "../../../src/domain";
import { placeOrder } from "../../../src/orders";

export async function slots() {
  if (!process.env.DATABASE_URL) return pickupSlots();
  return commercialPickupSlots();
}
export async function submitOrder(payload: unknown, campaign?: unknown) {
  const parsed = checkoutSchema.safeParse(payload);
  if (!parsed.success) return { error: "INVALID" } as const;
  if (process.env.DATABASE_URL && parsed.data.method === "demo") return { error: "METHOD" } as const;
  try {
    const allowed = await analyticsAllowed();
    const attribution = z.enum(campaignIds).safeParse(campaign);
    const order = await placeOrder(parsed.data, allowed ? { campaign: attribution.success ? attribution.data : null } : undefined);
    return { number: order.number.toString(), token: order.tracking_token } as const;
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return { error: ["SLOT", "MENU", "CONFLICT", "RATE", "PRICE"].includes(code) ? code : "FAILED" } as const;
  }
}
