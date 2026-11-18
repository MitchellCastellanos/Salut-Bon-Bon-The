"use server";
import { checkoutSchema, pickupSlots } from "../../../src/domain";
import { placeOrder } from "../../../src/orders";

export async function slots() { return pickupSlots(); }
export async function submitOrder(payload: unknown) {
  const parsed = checkoutSchema.safeParse(payload);
  if (!parsed.success) return { error: "INVALID" } as const;
  if (process.env.DATABASE_URL && parsed.data.method === "demo") return { error: "METHOD" } as const;
  try {
    const order = await placeOrder(parsed.data);
    return { number: order.number.toString(), token: order.tracking_token } as const;
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return { error: ["SLOT", "MENU", "CONFLICT"].includes(code) ? code : "FAILED" } as const;
  }
}
