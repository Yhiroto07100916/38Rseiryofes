CREATE TABLE tool_rental_tools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  total_quantity INTEGER NOT NULL CHECK (total_quantity > 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  external_tool_id TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX idx_tool_rental_tools_active_name
  ON tool_rental_tools(is_active, name COLLATE NOCASE);

CREATE TABLE tool_rental_loans (
  id TEXT PRIMARY KEY,
  tool_id TEXT NOT NULL,
  borrower_name TEXT NOT NULL,
  borrower_note TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status TEXT NOT NULL DEFAULT 'checked_out'
    CHECK (status IN ('checked_out', 'returned')),
  checked_out_by TEXT NOT NULL,
  checked_out_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  checkout_note TEXT,
  returned_by TEXT,
  returned_at TEXT,
  return_note TEXT,
  FOREIGN KEY (tool_id) REFERENCES tool_rental_tools(id) ON DELETE RESTRICT,
  FOREIGN KEY (checked_out_by) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (returned_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX idx_tool_rental_loans_tool_status
  ON tool_rental_loans(tool_id, status);

CREATE INDEX idx_tool_rental_loans_checked_out_at
  ON tool_rental_loans(checked_out_at DESC);

INSERT OR IGNORE INTO permissions (id, key, name, description, category)
VALUES
  ('permission-tool-rental-view', 'tool_rental.view', '工具一覧閲覧', '工具と貸出可能数を閲覧できる', 'tool_rental'),
  ('permission-tool-rental-checkout', 'tool_rental.checkout', '工具貸出処理', '工具の貸出を記録できる', 'tool_rental'),
  ('permission-tool-rental-return', 'tool_rental.return', '工具返却処理', '貸出中一覧を閲覧し返却を記録できる', 'tool_rental'),
  ('permission-tool-rental-manage', 'tool_rental.manage', '工具マスター管理', '工具の登録・編集・貸出停止ができる', 'tool_rental'),
  ('permission-tool-rental-history', 'tool_rental.history', '工具貸出履歴閲覧', '過去の貸出・返却履歴を閲覧できる', 'tool_rental');
