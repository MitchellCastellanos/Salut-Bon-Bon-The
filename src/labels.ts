/** One vocabulary for payment state across the dashboard, order list, order detail and staff queue. */
export const paymentLabels: Record<string, { label: string; tone: "good" | "warn" | "bad" | "neutral"; help: string }> = {
  UNPAID: { label: "Unpaid", tone: "warn", help: "Waiting for payment, or to be paid at pickup." },
  PAID_AT_PICKUP: { label: "Paid at pickup", tone: "good", help: "Payment recorded by the team at the counter." },
  PAID_ONLINE: { label: "Paid online", tone: "good", help: "Confirmed by the payment provider." },
  DEMO_PAID: { label: "Test payment", tone: "neutral", help: "Simulated payment. No money moved. Not counted as sales." },
  PAYMENT_FAILED: { label: "Payment failed", tone: "bad", help: "The card payment did not go through." },
  REFUND_REQUIRED: { label: "Refund due", tone: "bad", help: "The order was cancelled after payment. Refund it from the order page." },
  REFUNDED: { label: "Refunded", tone: "neutral", help: "The customer was refunded." },
};
export const paymentLabel = (payment: string) => paymentLabels[payment]?.label ?? payment.replaceAll("_", " ").toLowerCase();

export const orderStatusLabel: Record<string, string> = {
  RECEIVED: "New", CONFIRMED: "Confirmed", PREPARING: "Preparing", READY: "Ready for pickup", COMPLETED: "Completed", CANCELLED: "Cancelled",
};

/** Plain-language names for the technical codes that appear in the change history. */
export const auditLabels: Record<string, string> = {
  "product.update": "Drink edited", "product.create": "Drink added", "availability.update": "Drink shown or hidden", "eligibility.update": "Toppings changed",
  "category.update": "Category renamed", "category.create": "Category added", "modifier.update": "Topping edited", "modifier.create": "Topping added",
  "collection.update": "Collection edited", "campaign.update": "Homepage campaign edited", "pricing.sheet": "Price changed", "pricing.update": "Price changed",
  "store.update": "Hours or pickup settings", "store.orders-paused": "Online ordering paused", "store.orders-resumed": "Online ordering resumed",
  "business.profile": "Business information", "business.fiscal": "Tax settings", "order.cancel": "Order cancelled", "order.refund": "Order refunded", "demo.settings": "Demo settings applied", "demo.catalog": "Demo menu applied", "loyalty.program": "Rewards program rules", "loyalty.account": "Rewards card status", "loyalty.reward": "Reward edited",
};
export const auditLabel = (action: string) => auditLabels[action] ?? action.replaceAll(".", " · ").replaceAll("_", " ").replaceAll("-", " ");
