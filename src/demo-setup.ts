import { database } from "./db";
import { saveProgramConfig } from "./loyalty";
import { pickupPolicySchema } from "./pickup-policy";

type Db = { query<T extends Record<string, unknown>>(sql: string, args?: unknown[]): Promise<{ rows: T[] }> };

/** Owner-supplied hours (Mon–Sat 10:30–20:00, Sunday closed). Unverified: this is demonstration data. */
const demoPolicy = pickupPolicySchema.parse({
  leadMinutes: 10, slotMinutes: 15, slotCapacity: 10, advanceDays: 7, sameDayCutoff: null, exceptions: [],
  hours: Object.fromEntries(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => [day, [["10:30", "20:00"]]])),
});

/**
 * One explicit ADMIN action that makes the demonstration store operational: pickup hours, lead time and capacity, ordering switched on,
 * tax status "not registered" (no tax is invented), every priced product offered, and the Salut Rewards 9+1 program fully active with the
 * recorded authorization of the administrator who pressed the button. It never touches prices, never sends anything and never changes
 * provider configuration. Audited like any other admin change.
 */
export async function applyDemoSettings(actor: string, db?: Db) {
  const connection = db ?? await database();
  await connection.query(`
    WITH saved AS (
      INSERT INTO catalog_store_settings (key, value) VALUES
        ('pickup_policy', $1::jsonb), ('pickup_checkout_enabled', 'true'::jsonb),
        ('fiscal_settings', jsonb_build_object('status', 'not_registered', 'gstRate', 5000, 'qstRate', 9975,
           'receiptNote', 'Demonstration store: not a tax receipt.'))
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value RETURNING key, value
    ) INSERT INTO catalog_audit_history (action, subject, details) SELECT 'demo.settings', key, jsonb_build_object('value', value, 'actor', $2::text) FROM saved
  `, [JSON.stringify(demoPolicy), actor]);
  await connection.query(`
    WITH products AS (UPDATE catalog_products SET available = true WHERE id IN (SELECT product_id FROM catalog_variants WHERE price_cents > 0) RETURNING id),
    variants AS (UPDATE catalog_variants SET approved = true, available = true WHERE price_cents > 0 RETURNING product_id)
    INSERT INTO catalog_audit_history (action, subject, details)
    VALUES ('demo.catalog', 'offered', jsonb_build_object('products', (SELECT count(*) FROM products), 'variants', (SELECT count(*) FROM variants), 'actor', $1::text))
  `, [actor]);
  await saveProgramConfig({
    active: true, minOrderCents: 0, categories: [], previewVisible: true, accrualEnabled: true, redemptionEnabled: true, commercialAuthorized: true,
  }, actor, { production: false }, connection);
}
