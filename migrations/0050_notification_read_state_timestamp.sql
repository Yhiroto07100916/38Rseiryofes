ALTER TABLE notifications ADD COLUMN read_updated_at TEXT;

UPDATE notifications
SET read_updated_at = created_at
WHERE read_updated_at IS NULL;
