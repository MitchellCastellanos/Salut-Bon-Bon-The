-- A drink can now be off the website (published = false, e.g. a draft) or on the website but sold out (available = false).
-- Existing drinks stay published, so nothing disappears from the public menu when this migration is applied.
ALTER TABLE catalog_products ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT true;
