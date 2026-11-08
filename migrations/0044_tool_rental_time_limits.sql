ALTER TABLE loans ADD COLUMN time_limit_minutes INTEGER;

CREATE INDEX IF NOT EXISTS idx_loans_due_at_active
  ON loans(status, due_at)
  WHERE due_at IS NOT NULL;
