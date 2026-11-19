-- Applied to Neon production on 2026-11-18. CAD cents, before tax.
-- Idempotent replay. Large variants deliberately unchanged.
BEGIN;
UPDATE catalog_variants v SET price_cents = CASE p.category
  WHEN 'milk-tea' THEN 599 WHEN 'fruit-tea' THEN 599
  WHEN 'smoothies' THEN 799 WHEN 'fresh-mango-series' THEN 799
  WHEN 'creme-brulee' THEN 899 WHEN 'lemonade' THEN 599
  ELSE v.price_cents END, promotional_cents = NULL
FROM catalog_products p WHERE p.id=v.product_id AND v.id='regular'
  AND p.category IN ('milk-tea','fruit-tea','smoothies','fresh-mango-series','creme-brulee','lemonade');

UPDATE catalog_modifiers SET surcharge_cents=CASE WHEN group_id='tapioca' THEN 0 ELSE 100 END, available=true;
INSERT INTO catalog_product_modifier_groups(product_id,group_id,min_selections,max_selections)
SELECT p.id,g.id,CASE WHEN g.id='tapioca' THEN 1 ELSE 0 END,
 CASE WHEN g.id='tapioca' THEN 1 ELSE 12 END
FROM catalog_products p CROSS JOIN catalog_modifier_groups g
ON CONFLICT(product_id,group_id) DO UPDATE
 SET min_selections=excluded.min_selections,max_selections=excluded.max_selections;
INSERT INTO catalog_product_modifiers(product_id,group_id,modifier_id,selected_by_default)
SELECT p.id,m.group_id,m.id,m.group_id='tapioca'
FROM catalog_products p CROSS JOIN catalog_modifiers m
ON CONFLICT(product_id,modifier_id) DO UPDATE
 SET selected_by_default=excluded.selected_by_default;
COMMIT;
