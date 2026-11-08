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
  legacy_tool_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tools_active_display_order
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
  legacy_loan_id TEXT UNIQUE,
  FOREIGN KEY (borrower_id) REFERENCES borrowers(id) ON DELETE RESTRICT,
  FOREIGN KEY (returned_by_id) REFERENCES borrowers(id) ON DELETE RESTRICT,
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
  FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE,
  UNIQUE (loan_id, return_time_id, notice_date)
);

CREATE INDEX idx_loan_return_notices_loan
  ON loan_return_notices(loan_id, notice_date);

INSERT INTO tools (
  name,
  category,
  description,
  location,
  quantity,
  available_quantity,
  max_quantity_per_class,
  loan_duration_minutes,
  max_quantity_per_chief,
  loan_duration_minutes_per_chief,
  due_notice_enabled,
  universal_return_enabled,
  universal_return_enabled_for_chief,
  is_active,
  created_at,
  updated_at,
  legacy_tool_id
)
SELECT
  legacy.name,
  legacy.category,
  legacy.description,
  NULL,
  legacy.total_quantity,
  CASE
    WHEN legacy.total_quantity - COALESCE(SUM(
      CASE WHEN old_loans.status = 'checked_out' THEN old_loans.quantity ELSE 0 END
    ), 0) < 0 THEN 0
    ELSE legacy.total_quantity - COALESCE(SUM(
      CASE WHEN old_loans.status = 'checked_out' THEN old_loans.quantity ELSE 0 END
    ), 0)
  END,
  NULL,
  NULL,
  NULL,
  NULL,
  1,
  1,
  1,
  legacy.is_active,
  legacy.created_at,
  legacy.updated_at,
  legacy.id
FROM tool_rental_tools AS legacy
LEFT JOIN tool_rental_loans AS old_loans
  ON old_loans.tool_id = legacy.id
GROUP BY legacy.id;

WITH RECURSIVE item_numbers(number) AS (
  SELECT 1
  UNION ALL
  SELECT number + 1
  FROM item_numbers
  WHERE number < COALESCE((SELECT MAX(total_quantity) FROM tool_rental_tools), 0)
)
INSERT INTO tool_items (
  tool_id,
  management_number,
  status,
  created_at,
  updated_at
)
SELECT
  new_tools.id,
  'MIG-' || legacy.id || '-' || printf('%03d', item_numbers.number),
  CASE
    WHEN item_numbers.number <= COALESCE((
      SELECT SUM(quantity)
      FROM tool_rental_loans
      WHERE tool_id = legacy.id
        AND status = 'checked_out'
    ), 0) THEN 'borrowed'
    ELSE 'available'
  END,
  legacy.created_at,
  legacy.updated_at
FROM tool_rental_tools AS legacy
INNER JOIN tools AS new_tools
  ON new_tools.legacy_tool_id = legacy.id
INNER JOIN item_numbers
  ON item_numbers.number <= legacy.total_quantity;

INSERT OR IGNORE INTO borrowers (
  class_name,
  name,
  created_at,
  updated_at
)
SELECT
  '未設定',
  borrower_name,
  MIN(checked_out_at),
  MAX(COALESCE(returned_at, checked_out_at))
FROM tool_rental_loans
GROUP BY borrower_name;

INSERT INTO loans (
  borrower_id,
  tool_id,
  quantity,
  borrowed_at,
  returned_at,
  returned_by_id,
  returned_quantity,
  status,
  due_at,
  tool_name_snapshot,
  legacy_loan_id
)
SELECT
  borrowers.id,
  new_tools.id,
  old_loans.quantity,
  old_loans.checked_out_at,
  old_loans.returned_at,
  NULL,
  CASE WHEN old_loans.status = 'returned' THEN old_loans.quantity ELSE 0 END,
  CASE WHEN old_loans.status = 'returned' THEN 'returned' ELSE 'borrowed' END,
  NULL,
  COALESCE(old_loans.tool_name_snapshot, legacy_tools.name),
  old_loans.id
FROM tool_rental_loans AS old_loans
INNER JOIN tool_rental_tools AS legacy_tools
  ON legacy_tools.id = old_loans.tool_id
INNER JOIN tools AS new_tools
  ON new_tools.legacy_tool_id = legacy_tools.id
INNER JOIN borrowers
  ON borrowers.class_name = '未設定'
  AND borrowers.name = old_loans.borrower_name;

WITH RECURSIVE item_numbers(number) AS (
  SELECT 1
  UNION ALL
  SELECT number + 1
  FROM item_numbers
  WHERE number < COALESCE((SELECT MAX(quantity) FROM tool_rental_loans), 0)
),
active_offsets AS (
  SELECT
    current_loan.id,
    COALESCE((
      SELECT SUM(previous_loan.quantity)
      FROM tool_rental_loans AS previous_loan
      WHERE previous_loan.tool_id = current_loan.tool_id
        AND previous_loan.status = 'checked_out'
        AND (
          previous_loan.checked_out_at < current_loan.checked_out_at
          OR (
            previous_loan.checked_out_at = current_loan.checked_out_at
            AND previous_loan.id < current_loan.id
          )
        )
    ), 0) AS item_offset
  FROM tool_rental_loans AS current_loan
  WHERE current_loan.status = 'checked_out'
)
INSERT INTO loan_items (
  loan_id,
  tool_item_id,
  created_at,
  returned_at,
  returned_by_id
)
SELECT
  new_loans.id,
  new_items.id,
  old_loans.checked_out_at,
  CASE
    WHEN old_loans.status = 'returned'
    THEN COALESCE(old_loans.returned_at, old_loans.checked_out_at)
    ELSE NULL
  END,
  NULL
FROM tool_rental_loans AS old_loans
INNER JOIN loans AS new_loans
  ON new_loans.legacy_loan_id = old_loans.id
INNER JOIN tools AS new_tools
  ON new_tools.legacy_tool_id = old_loans.tool_id
LEFT JOIN active_offsets
  ON active_offsets.id = old_loans.id
INNER JOIN item_numbers
  ON item_numbers.number <= old_loans.quantity
INNER JOIN tool_items AS new_items
  ON new_items.tool_id = new_tools.id
  AND new_items.management_number =
    'MIG-' || old_loans.tool_id || '-' ||
    printf(
      '%03d',
      CASE
        WHEN old_loans.status = 'checked_out'
        THEN COALESCE(active_offsets.item_offset, 0) + item_numbers.number
        ELSE (
          (item_numbers.number - 1) %
          CASE WHEN new_tools.quantity > 0 THEN new_tools.quantity ELSE 1 END
        ) + 1
      END
    );

UPDATE tools
SET
  quantity = (
    SELECT COUNT(*)
    FROM tool_items
    WHERE tool_items.tool_id = tools.id
      AND tool_items.management_number NOT LIKE 'DELETED-%'
  ),
  available_quantity = (
    SELECT COUNT(*)
    FROM tool_items
    WHERE tool_items.tool_id = tools.id
      AND tool_items.status = 'available'
      AND tool_items.management_number NOT LIKE 'DELETED-%'
  )
WHERE legacy_tool_id IS NOT NULL;
