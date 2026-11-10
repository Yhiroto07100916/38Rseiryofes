-- Site-wide settings and audit history.
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS site_setting_logs (
  id TEXT PRIMARY KEY,
  setting_key TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  changed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_site_setting_logs_changed_at
  ON site_setting_logs(changed_at DESC);

INSERT OR IGNORE INTO account_roles (id, name, description)
VALUES (
  '9d8f5f60-2b4a-4e3c-9f10-000000000001',
  'important_settings_admin',
  '公開状態・メンテナンス・セキュリティなど重要なサイト設定を管理する権限'
);

-- Bootstrap existing site administrators as important settings administrators.
-- After this migration, only holders of important_settings_admin can grant or revoke this role.
INSERT OR IGNORE INTO user_account_roles (user_id, account_role_id)
SELECT uar.user_id, ar_important.id
FROM user_account_roles uar
INNER JOIN account_roles ar_admin ON ar_admin.id = uar.account_role_id
INNER JOIN account_roles ar_important ON ar_important.name = 'important_settings_admin'
WHERE ar_admin.name = 'admin';

INSERT OR IGNORE INTO site_settings (key, value, description)
VALUES
  ('site_name', '"38R星陵祭準備サイト"', 'サイトの表示名'),
  ('site_description', '"38Rの星陵祭準備を管理するサイトです。"', 'サイトの説明'),
  ('event_name', '"星陵祭"', '行事名'),
  ('event_year', '2026', '対象年度'),
  ('site_visibility', '"public"', 'サイトの公開状態'),
  ('maintenance_mode', 'false', 'メンテナンスモード'),
  ('maintenance_message', '"現在メンテナンス中です。しばらくお待ちください。"', 'メンテナンス時の表示文'),
  ('login_enabled', 'true', 'ログイン機能の有効・無効'),
  ('require_login', 'true', 'ログイン必須化');
