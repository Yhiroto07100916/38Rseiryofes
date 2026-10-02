CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  starts_at TEXT NOT NULL,
  ends_at TEXT,
  is_all_day INTEGER NOT NULL DEFAULT 0,
  location TEXT,
  color TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_starts_at
  ON calendar_events(starts_at);

CREATE INDEX IF NOT EXISTS idx_calendar_events_ends_at
  ON calendar_events(ends_at);

CREATE INDEX IF NOT EXISTS idx_calendar_events_created_by
  ON calendar_events(created_by);
