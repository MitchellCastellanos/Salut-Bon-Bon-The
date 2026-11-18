import { database } from "./db";
import { pickupPolicySchema, upcomingPickup } from "./pickup-policy";

export async function pickupConfiguration() {
  const { rows } = await (await database()).query<{ key: string; value: unknown }>(`
    SELECT key, value FROM catalog_store_settings WHERE key IN ('pickup_checkout_enabled', 'pickup_policy')
  `);
  const enabled = rows.some(row => row.key === "pickup_checkout_enabled" && row.value === true);
  const policy = pickupPolicySchema.safeParse(rows.find(row => row.key === "pickup_policy")?.value);
  return { enabled: enabled && policy.success, policy: policy.success ? policy.data : null };
}


export async function commercialPickupSlots() {
  const { enabled, policy } = await pickupConfiguration();
  if (!enabled || !policy) return [];
  const slots = upcomingPickup(policy);
  if (!slots.length) return slots;
  const { rows } = await (await database()).query<{ pickup_at: Date | string }>(`
    SELECT pickup_at FROM orders WHERE pickup_at = ANY($1::timestamptz[]) AND status <> 'CANCELLED'
    GROUP BY pickup_at HAVING count(*) >= $2
  `, [slots, policy.slotCapacity]);
  const full = new Set(rows.map(row => new Date(row.pickup_at).toISOString()));
  return slots.filter(slot => !full.has(slot)).slice(0, 12);
}
