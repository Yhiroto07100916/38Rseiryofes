PRAGMA foreign_keys = ON;

ALTER TABLE files
  ADD COLUMN access_scope TEXT NOT NULL DEFAULT 'all'
  CHECK (access_scope IN ('all', 'selected'));

CREATE TABLE file_user_access (
  file_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (file_id, user_id),
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_file_user_access_user_id
  ON file_user_access(user_id, file_id);
