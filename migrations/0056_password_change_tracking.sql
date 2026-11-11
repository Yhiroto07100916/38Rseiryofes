ALTER TABLE users ADD COLUMN password_changed_at TEXT;

UPDATE users
SET password_changed_at = NULL
WHERE password_changed_at IS NULL;
