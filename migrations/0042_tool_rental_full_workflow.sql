CREATE TABLE admin_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL DEFAULT '',
  session_version INTEGER NOT NULL DEFAULT 1,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tools (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  location TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  available_quantity INTEGER NOT NULL DEFAULT 0,
  max_quantity_per_class INTEGER,
  loan_duration_minutes INTEGER,
  max_quantity_per_chief INTEGER,
  loan_duration_minutes_per_chief INTEGER,
  due_notice_enabled INTEGER NOT NULL DEFAULT 1 CHECK (due_notice_enabled IN (0, 1)),
  universal_return_enabled INTEGER NOT NULL DEFAULT 1 CHECK (universal_return_enabled IN (0, 1)),
  universal_return_enabled_for_chief INTEGER NOT NULL DEFAULT 1 CHECK (universal_return_enabled_for_chief IN (0, 1)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  display_order INTEGER,
  external_tool_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tools_active_order
  ON tools(is_active, display_order, id);

CREATE TABLE tool_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_id INTEGER NOT NULL,
  management_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'borrowed', 'unavailable')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tool_id) REFERENCES tools(id) ON DELETE RESTRICT
);

CREATE INDEX idx_tool_items_tool_status
  ON tool_items(tool_id, status);

CREATE TABLE borrowers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_name TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (class_name, name)
);

CREATE TABLE loans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  borrower_id INTEGER NOT NULL,
  tool_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  borrowed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  returned_at TEXT,
  returned_by_id INTEGER,
  returned_quantity INTEGER NOT NULL DEFAULT 0 CHECK (returned_quantity >= 0),
  status TEXT NOT NULL DEFAULT 'borrowed'
    CHECK (status IN ('borrowed', 'returned')),
  due_at TEXT,
  due_notice_sent_at TEXT,
  due_at_notification_sent_at TEXT,
  return_notice_sent_at TEXT,
  tool_name_snapshot TEXT,
  FOREIGN KEY (returned_by_id) REFERENCES borrowers(id) ON DELETE RESTRICT,
  FOREIGN KEY (borrower_id) REFERENCES borrowers(id) ON DELETE RESTRICT,
  FOREIGN KEY (tool_id) REFERENCES tools(id) ON DELETE RESTRICT
);

CREATE INDEX idx_loans_status_due_at
  ON loans(status, due_at);

CREATE INDEX idx_loans_borrowed_at
  ON loans(borrowed_at DESC);

CREATE TABLE loan_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  loan_id INTEGER NOT NULL,
  tool_item_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  returned_at TEXT,
  returned_by_id INTEGER,
  extended_to_loan_id INTEGER,
  overdue_minutes INTEGER NOT NULL DEFAULT 0,
  overdue_seconds INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE RESTRICT,
  FOREIGN KEY (tool_item_id) REFERENCES tool_items(id) ON DELETE RESTRICT,
  FOREIGN KEY (returned_by_id) REFERENCES borrowers(id) ON DELETE RESTRICT,
  FOREIGN KEY (extended_to_loan_id) REFERENCES loans(id) ON DELETE RESTRICT
);

CREATE INDEX idx_loan_items_loan_returned
  ON loan_items(loan_id, returned_at);

CREATE INDEX idx_loan_items_tool_item
  ON loan_items(tool_item_id);

CREATE TABLE reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_id INTEGER NOT NULL,
  class_name TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'completed', 'cancelled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tool_id) REFERENCES tools(id) ON DELETE RESTRICT
);

CREATE INDEX idx_reservations_tool_status_created
  ON reservations(tool_id, status, created_at, id);

CREATE TABLE system_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  universal_return_time TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO system_settings (id, universal_return_time)
VALUES (1, NULL);

CREATE TABLE universal_return_times (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_time TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE universal_return_times_chief (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_time TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE loan_return_notices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  loan_id INTEGER NOT NULL,
  return_time_id INTEGER NOT NULL,
  return_time_type TEXT NOT NULL DEFAULT 'class'
    CHECK (return_time_type IN ('class', 'chief')),
  notice_date TEXT NOT NULL,
  notified_at TEXT,
  overdue_notified_at TEXT,
  FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_loan_return_notices_unique
  ON loan_return_notices(loan_id, return_time_id, return_time_type, notice_date);

CREATE TABLE notification_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  channel TEXT NOT NULL DEFAULT 'discord'
    CHECK (channel IN ('none', 'discord', 'line')),
  discord_webhook_encrypted TEXT,
  line_channel_access_token_encrypted TEXT,
  line_channel_secret_encrypted TEXT,
  line_destination_type TEXT
    CHECK (line_destination_type IS NULL OR line_destination_type IN ('user', 'group', 'room')),
  line_destination_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO notification_settings (id, channel)
VALUES (1, 'discord');

CREATE TABLE line_notification_destinations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  destination_type TEXT NOT NULL
    CHECK (destination_type IN ('user', 'group', 'room')),
  destination_id TEXT NOT NULL UNIQUE,
  display_name TEXT,
  last_seen_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_line_notification_destinations_last_seen
  ON line_notification_destinations(last_seen_at DESC);
