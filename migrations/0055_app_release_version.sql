-- Application release version and release notes.
INSERT OR IGNORE INTO site_settings (key, value, description)
VALUES
  ('app_version', '"v1.0.0"', 'アプリケーションのリリースバージョン'),
  ('release_notes', '"初期リリース"', '現在のリリース内容');
