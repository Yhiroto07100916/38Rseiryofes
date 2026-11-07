CREATE TABLE IF NOT EXISTS avatar_deletion_queue (
  object_key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_avatar_deletion_queue_created_at
  ON avatar_deletion_queue(created_at);
