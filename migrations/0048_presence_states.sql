ALTER TABLE loans ADD COLUMN checkout_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE loans ADD COLUMN borrower_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE loans ADD COLUMN presence_due_soon_notified_at TEXT;
ALTER TABLE loans ADD COLUMN presence_overdue_notified_at TEXT;
ALTER TABLE loan_items ADD COLUMN timer_alarm_notified_at TEXT;

CREATE TABLE presence_states (
  user_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('inside', 'outside', 'unknown')),
  method TEXT NOT NULL CHECK (method IN ('gps', 'manual')),
  checked_at TEXT NOT NULL,
  expires_at TEXT,
  local_date TEXT NOT NULL,
  last_gps_status TEXT CHECK (last_gps_status IS NULL OR last_gps_status IN ('inside', 'outside')),
  last_gps_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_presence_states_targeting ON presence_states(status, local_date, expires_at);
CREATE INDEX idx_loans_due_notification ON loans(status, due_at, presence_due_soon_notified_at, presence_overdue_notified_at);
