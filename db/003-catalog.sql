CREATE TABLE IF NOT EXISTS catalog_categories (
  id text PRIMARY KEY, fr text NOT NULL, en text NOT NULL
);
CREATE TABLE IF NOT EXISTS catalog_products (
  id text PRIMARY KEY, code text UNIQUE, category text NOT NULL REFERENCES catalog_categories,
  source_fr text, source_badge text, available boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS catalog_product_translations (
  product_id text REFERENCES catalog_products ON DELETE CASCADE,
  locale text CHECK (locale IN ('fr','en')), name text NOT NULL,
  PRIMARY KEY (product_id, locale)
);
CREATE TABLE IF NOT EXISTS catalog_variants (
  product_id text REFERENCES catalog_products ON DELETE CASCADE, id text,
  fr text NOT NULL, en text NOT NULL,
  price_cents integer CHECK (price_cents BETWEEN 1 AND 100000), promotional_cents integer CHECK (promotional_cents BETWEEN 1 AND 100000),
  approved boolean NOT NULL DEFAULT false, available boolean NOT NULL DEFAULT false,
  CHECK (promotional_cents IS NULL OR promotional_cents < price_cents),
  CHECK (NOT approved OR price_cents IS NOT NULL),
  PRIMARY KEY (product_id, id)
);
CREATE TABLE IF NOT EXISTS catalog_modifier_groups (id text PRIMARY KEY);
CREATE TABLE IF NOT EXISTS catalog_modifiers (
  id text PRIMARY KEY, group_id text NOT NULL REFERENCES catalog_modifier_groups,
  fr text NOT NULL, en text NOT NULL, available boolean NOT NULL DEFAULT false,
  surcharge_cents integer CHECK (surcharge_cents BETWEEN 0 AND 100000),
  UNIQUE (id, group_id)
);
CREATE TABLE IF NOT EXISTS catalog_product_modifier_groups (
  product_id text REFERENCES catalog_products, group_id text REFERENCES catalog_modifier_groups,
  min_selections integer NOT NULL CHECK (min_selections >= 0),
  max_selections integer NOT NULL CHECK (max_selections >= min_selections),
  PRIMARY KEY (product_id, group_id)
);
CREATE TABLE IF NOT EXISTS catalog_product_modifiers (
  product_id text, group_id text, modifier_id text,
  selected_by_default boolean NOT NULL DEFAULT false,
  PRIMARY KEY (product_id, modifier_id),
  FOREIGN KEY (product_id, group_id) REFERENCES catalog_product_modifier_groups,
  FOREIGN KEY (modifier_id, group_id) REFERENCES catalog_modifiers (id, group_id)
);
CREATE TABLE IF NOT EXISTS catalog_collections (
  id text PRIMARY KEY, fr text NOT NULL, en text NOT NULL
);
CREATE TABLE IF NOT EXISTS catalog_collection_products (
  collection_id text REFERENCES catalog_collections, product_id text REFERENCES catalog_products,
  position integer NOT NULL, PRIMARY KEY (collection_id, product_id)
);
CREATE TABLE IF NOT EXISTS catalog_product_images (
  product_id text REFERENCES catalog_products, path text, position integer NOT NULL,
  PRIMARY KEY (product_id, path)
);
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id text PRIMARY KEY, collection_id text REFERENCES catalog_collections,
  published boolean NOT NULL DEFAULT false, active boolean NOT NULL DEFAULT false,
  starts_at timestamptz, ends_at timestamptz, homepage_position integer,
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);
CREATE TABLE IF NOT EXISTS marketing_campaign_translations (
  campaign_id text REFERENCES marketing_campaigns, locale text CHECK (locale IN ('fr','en')),
  headline text NOT NULL, seo_description text, PRIMARY KEY (campaign_id, locale)
);
CREATE TABLE IF NOT EXISTS marketing_campaign_assets (
  campaign_id text REFERENCES marketing_campaigns, path text, PRIMARY KEY (campaign_id, path)
);
CREATE TABLE IF NOT EXISTS catalog_featured_placements (
  placement text, product_id text REFERENCES catalog_products, position integer NOT NULL,
  PRIMARY KEY (placement, product_id)
);
CREATE TABLE IF NOT EXISTS catalog_store_settings (key text PRIMARY KEY, value jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS marketing_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, event text NOT NULL,
  campaign_id text REFERENCES marketing_campaigns, occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS catalog_audit_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, action text NOT NULL,
  subject text NOT NULL, details jsonb NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS checkout_rate_limit (
  id integer PRIMARY KEY CHECK (id = 1), minute timestamptz NOT NULL,
  attempts integer NOT NULL CHECK (attempts BETWEEN 1 AND 60)
);
