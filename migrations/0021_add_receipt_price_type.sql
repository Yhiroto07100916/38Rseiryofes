ALTER TABLE receipt_items
ADD COLUMN price_type TEXT NOT NULL DEFAULT 'unknown'
CHECK (price_type IN ('tax_included', 'tax_excluded', 'unknown'));
