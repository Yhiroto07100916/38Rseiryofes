CREATE TABLE files (
    id TEXT PRIMARY KEY,
    object_key TEXT NOT NULL UNIQUE,
    original_name TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size INTEGER NOT NULL CHECK (size >= 0),
    category TEXT NOT NULL,
    uploaded_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX idx_files_object_key
    ON files(object_key);

CREATE INDEX idx_files_category
    ON files(category);

CREATE INDEX idx_files_uploaded_by
    ON files(uploaded_by);

CREATE INDEX idx_files_created_at
    ON files(created_at);
