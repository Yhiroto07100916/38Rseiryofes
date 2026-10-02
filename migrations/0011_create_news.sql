CREATE TABLE IF NOT EXISTS news (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  author TEXT NOT NULL,
  is_important INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE RESTRICT,

  CHECK (is_important IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_news_created_at
  ON news(created_at);

CREATE INDEX IF NOT EXISTS idx_news_is_important
  ON news(is_important);

CREATE TABLE IF NOT EXISTS news_calendar_events (
  news_id TEXT NOT NULL,
  event_id TEXT NOT NULL,

  PRIMARY KEY (news_id, event_id),

  FOREIGN KEY (news_id)
    REFERENCES news(id)
    ON DELETE CASCADE,

  FOREIGN KEY (event_id)
    REFERENCES calendar_events(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_news_calendar_events_news_id
  ON news_calendar_events(news_id);

CREATE INDEX IF NOT EXISTS idx_news_calendar_events_event_id
  ON news_calendar_events(event_id);

CREATE TABLE IF NOT EXISTS news_attachments (
  id TEXT PRIMARY KEY,
  news_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_key TEXT NOT NULL,
  content_type TEXT,
  file_size INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (news_id)
    REFERENCES news(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_news_attachments_news_id
  ON news_attachments(news_id);

INSERT OR IGNORE INTO permissions (
  id,
  key,
  name,
  description,
  category
)
VALUES
  (
    'permission-news-view',
    'news.view',
    'お知らせ閲覧',
    'お知らせを閲覧できる',
    'news'
  ),
  (
    'permission-news-create',
    'news.create',
    'お知らせ作成',
    'お知らせを作成できる',
    'news'
  ),
  (
    'permission-news-edit',
    'news.edit',
    'お知らせ編集',
    'お知らせを編集できる',
    'news'
  ),
  (
    'permission-news-delete',
    'news.delete',
    'お知らせ削除',
    'お知らせを削除できる',
    'news'
  );

INSERT OR IGNORE INTO account_role_permissions (
  account_role_id,
  permission_id,
  effect
)
SELECT
  ar.id,
  p.id,
  'allow'
FROM account_roles ar
CROSS JOIN permissions p
WHERE ar.id = '7b6f7c6e-5f6c-4e3d-9f9b-000000000001'
  AND p.key IN (
    'news.view',
    'news.create',
    'news.edit',
    'news.delete'
  );
