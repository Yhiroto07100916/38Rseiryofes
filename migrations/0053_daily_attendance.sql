CREATE TABLE attendance_records (
  local_date TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'early_leave', 'excused', 'unconfirmed')),
  source TEXT NOT NULL CHECK (source IN ('gps', 'manual')),
  gps_checked_in_at TEXT,
  note TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (local_date, user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_attendance_records_date_status
  ON attendance_records(local_date, status);

CREATE TABLE attendance_events (
  id TEXT PRIMARY KEY,
  local_date TEXT NOT NULL,
  user_id TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_attendance_events_user_date
  ON attendance_events(user_id, local_date, changed_at);
