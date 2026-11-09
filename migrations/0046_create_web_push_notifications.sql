CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_created_at
  ON push_subscriptions(created_at);

CREATE TABLE IF NOT EXISTS push_notification_deliveries (
  id TEXT PRIMARY KEY,
  news_id TEXT NOT NULL,
  subscription_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'sending', 'sent', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lease_until TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(news_id, subscription_id),
  FOREIGN KEY(news_id) REFERENCES news(id) ON DELETE CASCADE,
  FOREIGN KEY(subscription_id) REFERENCES push_subscriptions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_push_deliveries_due
  ON push_notification_deliveries(status, next_attempt_at);

CREATE INDEX IF NOT EXISTS idx_push_deliveries_news
  ON push_notification_deliveries(news_id);
