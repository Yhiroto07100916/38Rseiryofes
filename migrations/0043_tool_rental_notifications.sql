CREATE TABLE notification_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  channel TEXT NOT NULL DEFAULT 'none'
    CHECK (channel IN ('none', 'discord', 'line')),
  discord_webhook_encrypted TEXT,
  line_channel_access_token_encrypted TEXT,
  line_channel_secret_encrypted TEXT,
  line_destination_type TEXT
    CHECK (line_destination_type IS NULL OR line_destination_type IN ('user', 'group', 'room')),
  line_destination_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO notification_settings (id, channel)
VALUES (1, 'none');

CREATE TABLE line_notification_destinations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  destination_type TEXT NOT NULL
    CHECK (destination_type IN ('user', 'group', 'room')),
  destination_id TEXT NOT NULL UNIQUE,
  display_name TEXT,
  last_seen_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_line_notification_destinations_last_seen
  ON line_notification_destinations(last_seen_at DESC);

CREATE TABLE loan_return_notices_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  loan_id INTEGER NOT NULL,
  return_time_id INTEGER NOT NULL,
  return_time_type TEXT NOT NULL DEFAULT 'class'
    CHECK (return_time_type IN ('class', 'chief')),
  notice_date TEXT NOT NULL,
  notified_at TEXT,
  overdue_notified_at TEXT,
  FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE,
  UNIQUE (loan_id, return_time_id, return_time_type, notice_date)
);

INSERT INTO loan_return_notices_v2 (
  id, loan_id, return_time_id, return_time_type,
  notice_date, notified_at, overdue_notified_at
)
SELECT
  id, loan_id, return_time_id, return_time_type,
  notice_date, notified_at, overdue_notified_at
FROM loan_return_notices;

DROP TABLE loan_return_notices;

ALTER TABLE loan_return_notices_v2 RENAME TO loan_return_notices;

CREATE INDEX idx_loan_return_notices_loan
  ON loan_return_notices(loan_id, notice_date);
