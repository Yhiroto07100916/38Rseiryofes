ALTER TABLE notifications ADD COLUMN read_version INTEGER NOT NULL DEFAULT 0;

UPDATE notifications
SET read_version = 1
WHERE read_updated_at IS NOT NULL;
