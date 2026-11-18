import { database } from "./db";
import { getBusinessProfile, getFiscalSettings, type Blocker } from "./business";
import { pickupParametersSet, pickupPolicySchema, upcomingPickup } from "./pickup-policy";

/**
 * Pickup checkout opens only when every operational value is valid: the switch is on, a weekly schedule, lead time and
 * capacity are set, a fiscal status is chosen, the business profile exists and at least one product is priced.
 * `blockers` lists exactly what is missing so the admin can see why checkout is off.
 */
export async function pickupConfiguration() {
  const db = await database();
  const { rows } = await db.query<{ key: string; value: unknown }>(`
    SELECT key, value FROM catalog_store_settings WHERE key IN ('pickup_checkout_enabled', 'pickup_policy')
  `);
  const flag = rows.some(row => row.key === "pickup_checkout_enabled" && row.value === true);
  const parsed = pickupPolicySchema.safeParse(rows.find(row => row.key === "pickup_policy")?.value);
  const policy = parsed.success ? parsed.data : null;
  const [fiscal, profile] = await Promise.all([getFiscalSettings(db), getBusinessProfile(db)]);
  const { rows: [priced] } = await db.query<{ n: number }>(`
    SELECT count(*)::int AS n FROM catalog_variants v JOIN catalog_products p ON p.id = v.product_id
    WHERE p.available AND v.available AND v.approved AND v.price_cents > 0 AND v.id IN ('regular', 'large')`);
  const blockers: Blocker[] = [];
  if (!flag) blockers.push("FLAG_OFF");
  if (!policy) blockers.push("NO_SCHEDULE");
  else {
    if (policy.leadMinutes === undefined) blockers.push("NO_LEAD_TIME");
    if (policy.slotCapacity === undefined) blockers.push("NO_CAPACITY");
  }
  if (fiscal.status === "unconfigured") blockers.push("NO_FISCAL_STATUS");
  if (!profile) blockers.push("NO_PROFILE");
  if (!priced.n) blockers.push("NO_PRICES");
  return {
    enabled: blockers.length === 0, flag, blockers, policy, fiscal, profile,
    ready: policy && pickupParametersSet(policy) ? policy : null,
    taxRates: fiscal.status === "registered" ? [fiscal.gstRate, fiscal.qstRate] : [],
  };
}

export async function commercialPickupSlots() {
  const { enabled, ready: policy } = await pickupConfiguration();
  if (!enabled || !policy) return [];
  const slots = upcomingPickup(policy);
  if (!slots.length) return slots;
  const { rows } = await (await database()).query<{ pickup_at: Date | string }>(`
    SELECT pickup_at FROM orders WHERE pickup_at = ANY($1::timestamptz[]) AND status <> 'CANCELLED'
    GROUP BY pickup_at HAVING count(*) >= $2
  `, [slots, policy.slotCapacity]);
  const full = new Set(rows.map(row => new Date(row.pickup_at).toISOString()));
  return slots.filter(slot => !full.has(slot)).slice(0, 96);
}
