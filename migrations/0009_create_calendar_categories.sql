CREATE TABLE IF NOT EXISTS calendar_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_calendar_categories_sort_order
  ON calendar_categories(sort_order);

CREATE INDEX IF NOT EXISTS idx_calendar_categories_is_active
  ON calendar_categories(is_active);

ALTER TABLE calendar_events
  ADD COLUMN category_id TEXT REFERENCES calendar_categories(id);

CREATE INDEX IF NOT EXISTS idx_calendar_events_category_id
  ON calendar_events(category_id);

INSERT OR IGNORE INTO calendar_categories (
  id,
  name,
  color,
  sort_order,
  is_active
)
VALUES
  ('calendar-cat-meeting', '会議', '#1976D2', 10, 1),
  ('calendar-cat-practice', '練習', '#43A047', 20, 1),
  ('calendar-cat-submission', '提出', '#FB8C00', 30, 1),
  ('calendar-cat-performance', '本番', '#E53935', 40, 1),
  ('calendar-cat-other', 'その他', '#546E7A', 50, 1);

UPDATE calendar_events
SET category_id = (
  SELECT id
  FROM calendar_categories
  WHERE calendar_categories.color = calendar_events.color
  ORDER BY sort_order
  LIMIT 1
)
WHERE category_id IS NULL
  AND color IS NOT NULL;
