ALTER TABLE push_subscriptions ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);

ALTER TABLE loans ADD COLUMN checkout_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
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
CREATE INDEX idx_presence_states_targeting
  ON presence_states(status, local_date, expires_at);

CREATE TABLE notification_events (
  id TEXT PRIMARY KEY,
  event_key TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target_url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_notifications (
  id TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(notification_id, user_id),
  FOREIGN KEY (notification_id) REFERENCES notification_events(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_user_notifications_user_created
  ON user_notifications(user_id, created_at DESC);

CREATE TABLE notification_push_deliveries (
  id TEXT PRIMARY KEY,
  user_notification_id TEXT NOT NULL,
  subscription_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lease_until TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_notification_id, subscription_id),
  FOREIGN KEY (user_notification_id) REFERENCES user_notifications(id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id) REFERENCES push_subscriptions(id) ON DELETE CASCADE
);
CREATE INDEX idx_notification_push_due
  ON notification_push_deliveries(status, next_attempt_at);
