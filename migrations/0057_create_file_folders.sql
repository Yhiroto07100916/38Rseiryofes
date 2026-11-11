CREATE TABLE IF NOT EXISTS file_folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  parent_id TEXT REFERENCES file_folders(id) ON DELETE RESTRICT,
  category TEXT REFERENCES file_categories(slug) ON DELETE SET NULL,
  description TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_file_folders_parent_id ON file_folders(parent_id, name);
CREATE INDEX IF NOT EXISTS idx_file_folders_category ON file_folders(category);

ALTER TABLE files ADD COLUMN folder_id TEXT REFERENCES file_folders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_files_folder_id ON files(folder_id, archived_at, created_at);
