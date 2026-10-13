ALTER TABLE files ADD COLUMN archived_at TEXT;
ALTER TABLE files ADD COLUMN archived_by TEXT;
ALTER TABLE files ADD COLUMN ai_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (ai_status IN ('pending', 'processing', 'completed', 'failed'));
ALTER TABLE files ADD COLUMN ai_summary TEXT;
ALTER TABLE files ADD COLUMN extracted_text TEXT;

CREATE TABLE file_categories (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO file_categories (slug, name, sort_order) VALUES
  ('documents', '資料・配布物', 1),
  ('scripts', '台本', 2),
  ('photos', '写真', 3),
  ('uploads', 'その他', 4),
  ('receipts', '会計・領収書', 5);

CREATE INDEX idx_files_archived_at ON files(archived_at);
CREATE INDEX idx_files_ai_status ON files(ai_status);
CREATE INDEX idx_file_categories_sort_order
  ON file_categories(sort_order, name);
