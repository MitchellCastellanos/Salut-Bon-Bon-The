-- In-person (counter) orders. Additive: existing rows default to ONLINE and existing code ignores the new columns.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'ONLINE' CHECK (channel IN ('ONLINE', 'COUNTER'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS counter_tender text CHECK (counter_tender IS NULL OR counter_tender IN ('cash', 'terminal', 'other'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_by text CHECK (created_by IS NULL OR length(created_by) <= 64);
ALTER TABLE orders ADD CONSTRAINT orders_counter_requires_tender CHECK (channel = 'ONLINE' OR counter_tender IS NOT NULL);
CREATE INDEX IF NOT EXISTS orders_channel_created_idx ON orders (channel, created_at DESC);
