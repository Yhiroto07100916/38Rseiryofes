CREATE TABLE wishlist_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  product_url TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  estimated_cost INTEGER,
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'requested',
  memo TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_wishlist_items_created_by
  ON wishlist_items(created_by);

CREATE INDEX idx_wishlist_items_status
  ON wishlist_items(status);

CREATE INDEX idx_wishlist_items_priority
  ON wishlist_items(priority);

CREATE INDEX idx_wishlist_items_updated_at
  ON wishlist_items(updated_at);
