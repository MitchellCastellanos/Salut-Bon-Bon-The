-- Client-confirmed prices, November 18, 2026. CAD cents, before taxes.
-- Run against a reviewed database branch before production.
BEGIN;
UPDATE catalog_variants v SET price_cents = CASE p.category
  WHEN 'milk-tea' THEN 599 WHEN 'fruit-tea' THEN 599
  WHEN 'smoothies' THEN 799 WHEN 'fresh-mango-series' THEN 799
  WHEN 'creme-brulee' THEN 899 WHEN 'lemonade' THEN 599
  ELSE v.price_cents END,
  promotional_cents = NULL
FROM catalog_products p WHERE p.id = v.product_id
  AND v.id = 'regular'
  AND p.category IN ('milk-tea','fruit-tea','smoothies','fresh-mango-series','creme-brulee','lemonade');

-- No large-size price was supplied. Do not invent a surcharge or overwrite it.
-- Matcha price also remains unconfirmed.
-- All existing extra toppings are $1; the first included tapioca portion is free.
UPDATE catalog_modifiers SET surcharge_cents = 100
WHERE group_id IN ('popping','jelly','brown-sugar');
UPDATE catalog_modifiers SET surcharge_cents = 0
WHERE group_id = 'tapioca';
-- Existing tapioca assignments default to included.
UPDATE catalog_product_modifiers SET selected_by_default = true
WHERE group_id = 'tapioca';
-- Require exactly one tapioca option where the group is already assigned.
UPDATE catalog_product_modifier_groups SET min_selections = 1, max_selections = 1
WHERE group_id = 'tapioca';
COMMIT;
