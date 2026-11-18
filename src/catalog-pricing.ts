import { selectionCost, type CatalogOptionGroup } from "./catalog-options";
import type { Line } from "./domain";
import { database } from "./db";

type PriceRow = { id: string; size: Line["size"]; cents: number; fr: string; en: string };

export async function officialPrices(): Promise<(PriceRow & { groups: CatalogOptionGroup[] })[]> {
  const { rows } = await (await database()).query<PriceRow>(`
    SELECT p.id, v.id AS size, coalesce(v.promotional_cents, v.price_cents) AS cents,
           fr.name AS fr, en.name AS en
    FROM catalog_products p
    JOIN catalog_variants v ON v.product_id = p.id
    JOIN catalog_product_translations fr ON fr.product_id = p.id AND fr.locale = 'fr'
    JOIN catalog_product_translations en ON en.product_id = p.id AND en.locale = 'en'
    WHERE p.available AND v.available AND v.approved AND v.price_cents > 0
      AND v.id IN ('regular', 'large')
      AND EXISTS (SELECT 1 FROM catalog_store_settings WHERE key = 'pickup_checkout_enabled' AND value = 'true'::jsonb)
    ORDER BY p.id, v.id DESC
  `);
  if (!rows.length) return [];
  const ids = [...new Set(rows.map(row => row.id))];
  const { rows: assignments } = await (await database()).query<{
    product_id: string;
    group_id: string;
    min_selections: number;
    max_selections: number;
    options: CatalogOptionGroup["options"];
  }>(`
    SELECT g.product_id, g.group_id, g.min_selections, g.max_selections,
           coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'fr', m.fr, 'en', m.en,
             'cents', m.surcharge_cents, 'default', a.selected_by_default) ORDER BY m.id)
             FILTER (WHERE m.id IS NOT NULL), '[]'::jsonb) AS options
    FROM catalog_product_modifier_groups g
    LEFT JOIN catalog_product_modifiers a ON (a.product_id, a.group_id) = (g.product_id, g.group_id)
    LEFT JOIN catalog_modifiers m ON m.id = a.modifier_id AND m.group_id = g.group_id
      AND m.available AND m.surcharge_cents IS NOT NULL
    WHERE g.product_id = ANY($1::text[])
    GROUP BY g.product_id, g.group_id, g.min_selections, g.max_selections
    ORDER BY g.group_id
  `, [ids]);
  return rows.flatMap(row => {
    const groups = assignments.filter(group => group.product_id === row.id).map(group => ({
      id: group.group_id, min: group.min_selections, max: group.max_selections, options: group.options,
    }));
    return groups.some(group => group.options.length < group.min) ? [] : [{ ...row, groups }];
  });
}

export async function quoteOfficial(lines: Line[]) {
  const prices = await officialPrices();
  return lines.map(line => {
    const price = prices.find(row => row.id === line.product && row.size === line.size);
    if (!price || line.topping !== "none") throw new Error("MENU");
    const { selected, cents } = selectionCost(price.groups, line.optionIds ?? []);
    return { ...line, name: { fr: price.fr, en: price.en }, selectedModifiers: selected,
      subtotal: (price.cents + cents) * line.quantity };
  });
}
