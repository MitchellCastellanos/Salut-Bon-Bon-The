WITH source AS (SELECT $1::jsonb AS data),
categories AS (
  INSERT INTO catalog_categories
  SELECT id, fr, en FROM source, jsonb_to_recordset(data->'categories') AS x(id text, fr text, en text)
  ON CONFLICT (id) DO NOTHING
),
products AS (
  INSERT INTO catalog_products (id, code, category, source_fr, source_badge)
  SELECT id, code, category, source_fr, source_badge FROM source,
    jsonb_to_recordset(data->'products') AS x(id text, code text, category text, source_fr text, source_badge text)
  ON CONFLICT (id) DO NOTHING
),
translations AS (
  INSERT INTO catalog_product_translations
  SELECT id, locale, name FROM source,
    jsonb_to_recordset(data->'products') AS x(id text, fr text, en text),
    LATERAL (VALUES ('fr', fr), ('en', en)) AS t(locale, name)
  ON CONFLICT DO NOTHING
),
groups AS (
  INSERT INTO catalog_modifier_groups
  SELECT DISTINCT group_id FROM source, jsonb_to_recordset(data->'modifiers') AS x(group_id text)
  ON CONFLICT DO NOTHING
),
modifiers AS (
  INSERT INTO catalog_modifiers (id, group_id, fr, en)
  SELECT id, group_id, fr, en FROM source,
    jsonb_to_recordset(data->'modifiers') AS x(id text, group_id text, fr text, en text)
  ON CONFLICT (id) DO NOTHING
),
collections AS (
  INSERT INTO catalog_collections
  SELECT id, fr, en FROM source, jsonb_to_recordset(data->'collections') AS x(id text, fr text, en text)
  ON CONFLICT (id) DO NOTHING
),
members AS (
  INSERT INTO catalog_collection_products
  SELECT id, product_id, position FROM source, jsonb_to_recordset(data->'collections') AS x(id text, products jsonb),
    jsonb_array_elements_text(products) WITH ORDINALITY AS m(product_id, position)
  ON CONFLICT DO NOTHING
),
campaigns AS (
  INSERT INTO marketing_campaigns (id, collection_id, published, active, homepage_position)
  SELECT item->>'id', item->>'id', true, true, position
  FROM source, jsonb_array_elements(data->'collections') WITH ORDINALITY AS c(item, position)
  ON CONFLICT DO NOTHING
)
INSERT INTO marketing_campaign_translations (campaign_id, locale, headline)
SELECT id, locale, headline FROM source,
  jsonb_to_recordset(data->'collections') AS x(id text, headline_fr text, headline_en text),
  LATERAL (VALUES ('fr', headline_fr), ('en', headline_en)) AS t(locale, headline)
ON CONFLICT DO NOTHING;
