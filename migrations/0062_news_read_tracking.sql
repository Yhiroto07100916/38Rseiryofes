PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS news_read_receipts (
  news_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  read_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (news_id, user_id),
  FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_news_read_receipts_user_id
  ON news_read_receipts(user_id, news_id);

INSERT OR IGNORE INTO permissions (
  id,
  key,
  name,
  description,
  category
)
VALUES
  (
    'permission-news-read-stats-view',
    'news.read_stats.view',
    'お知らせ既読数閲覧',
    'お知らせごとの既読数・未読数を確認できる',
    'news'
  ),
  (
    'permission-news-unread-users-view',
    'news.unread_users.view',
    'お知らせ未読者閲覧',
    'お知らせごとの未読者一覧を確認できる',
    'news'
  );
