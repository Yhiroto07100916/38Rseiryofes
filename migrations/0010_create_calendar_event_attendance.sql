CREATE TABLE IF NOT EXISTS calendar_event_attendance (
  event_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (event_id, user_id),

  FOREIGN KEY (event_id)
    REFERENCES calendar_events(id)
    ON DELETE CASCADE,

  FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE,

  CHECK (status IN ('attending', 'not_attending', 'undecided'))
);

CREATE INDEX IF NOT EXISTS idx_calendar_event_attendance_event_id
  ON calendar_event_attendance(event_id);

CREATE INDEX IF NOT EXISTS idx_calendar_event_attendance_user_id
  ON calendar_event_attendance(user_id);

CREATE INDEX IF NOT EXISTS idx_calendar_event_attendance_status
  ON calendar_event_attendance(status);

INSERT OR IGNORE INTO permissions (
  id,
  key,
  name,
  description,
  category
)
VALUES (
  'permission-schedule-attendance',
  'schedule.attendance',
  '予定参加状況',
  '予定への参加状況を登録・変更できる',
  'schedule'
);

INSERT OR IGNORE INTO account_role_permissions (
  account_role_id,
  permission_id,
  effect
)
VALUES (
  '7b6f7c6e-5f6c-4e3d-9f9b-000000000001',
  'permission-schedule-attendance',
  'allow'
);

INSERT OR IGNORE INTO account_role_permissions (
  account_role_id, permission_id, effect
)
VALUES (
  '7b6f7c6e-5f6c-4e3d-9f9b-000000000002',
  'permission-schedule-attendance',
  'allow'
);
