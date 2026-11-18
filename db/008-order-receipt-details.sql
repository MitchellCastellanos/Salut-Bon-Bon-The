-- Quebec bills must show the GST and QST amounts separately and the business's registration details as they were
-- when the order was placed. Both are stored on the order so later settings changes never rewrite a past receipt.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_breakdown jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS business_snapshot jsonb;
