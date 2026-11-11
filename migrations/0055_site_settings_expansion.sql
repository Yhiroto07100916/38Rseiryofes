-- Extended site configuration for branding, features, notifications, operations and security.
INSERT OR IGNORE INTO site_settings (key, value, description)
VALUES
  ('timezone', '"Asia/Tokyo"', 'サイトのタイムゾーン'),
  ('logo_url', '""', 'サイトロゴ画像URL'),
  ('favicon_url', '""', 'favicon画像URL'),
  ('feature_settings', '{"tasks":{"enabled":true},"calendar":{"enabled":true},"news":{"enabled":true},"scripts":{"enabled":true},"accounting":{"enabled":true},"equipment":{"enabled":true},"attendance":{"enabled":true},"surveys":{"enabled":true},"files":{"enabled":true},"submissions":{"enabled":true},"decisions":{"enabled":true},"minutes":{"enabled":true},"tool_rental":{"enabled":true},"wishlist":{"enabled":true},"milk_collection":{"enabled":true},"members":{"enabled":true}}', '機能の有効状態と操作単位の制御'),
  ('notification_settings', '{"enabled":true,"categories":{"news":true,"tasks":true,"calendar":true,"attendance":true,"submissions":true,"tool_rental":true,"surveys":true,"decisions":true,"equipment":true,"accounting":true,"files":true,"milk_collection":true,"wishlist":true,"account_admin":true},"return_due_all_users":true}', 'サイト全体のプッシュ通知設定'),
  ('operation_settings', '{"calendar_default_view":"month","task_default_status":"todo","upload_max_file_size_mb":25}', '運用時の初期値とアップロード制限'),
  ('security_settings', '{"session_duration_hours":168,"login_attempt_limit":5,"login_lock_minutes":15,"force_password_change":false}', '認証・セキュリティ設定');

CREATE TABLE IF NOT EXISTS login_attempt_locks (
  identifier_hash TEXT PRIMARY KEY,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_login_attempt_locks_locked_until
  ON login_attempt_locks(locked_until);
