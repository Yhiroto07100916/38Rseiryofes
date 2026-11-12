PRAGMA foreign_keys = ON;

ALTER TABLE decisions
  ADD COLUMN minute_id TEXT REFERENCES minutes(id) ON DELETE SET NULL;

CREATE INDEX idx_decisions_minute_id ON decisions(minute_id);
