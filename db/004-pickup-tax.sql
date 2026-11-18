ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_cents integer NOT NULL DEFAULT 0 CHECK (tax_cents >= 0 AND tax_cents <= total);
