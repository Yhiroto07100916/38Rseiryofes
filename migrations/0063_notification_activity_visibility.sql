ALTER TABLE notifications
ADD COLUMN is_personal INTEGER NOT NULL DEFAULT 1
  CHECK (is_personal IN (0, 1));

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_personal_created
  ON notifications(recipient_user_id, is_personal, created_at DESC, id DESC);
