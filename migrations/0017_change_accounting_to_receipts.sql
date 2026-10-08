PRAGMA foreign_keys = OFF;

ALTER TABLE expense_reimbursements RENAME TO expense_reimbursements_legacy;
ALTER TABLE expenses RENAME TO expenses_legacy;

CREATE TABLE receipts (
    id TEXT PRIMARY KEY,
    purchased_at TEXT NOT NULL,
    store_name TEXT NOT NULL,
    total_amount INTEGER NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    payment_method TEXT NOT NULL DEFAULT 'budget'
        CHECK (payment_method IN ('budget', 'advance')),
    paid_by_user_id TEXT,
    tag TEXT,
    description TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (paid_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_receipts_purchased_at
    ON receipts(purchased_at);

CREATE INDEX idx_receipts_paid_by_user_id
    ON receipts(paid_by_user_id);

CREATE INDEX idx_receipts_payment_method
    ON receipts(payment_method);

CREATE INDEX idx_receipts_tag
    ON receipts(tag);

CREATE INDEX idx_receipts_updated_at
    ON receipts(updated_at);

CREATE TABLE receipt_items (
    id TEXT PRIMARY KEY,
    receipt_id TEXT NOT NULL,
    budget_item_id TEXT,
    name TEXT NOT NULL,
    unit_price INTEGER NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
    quantity REAL NOT NULL DEFAULT 1 CHECK (quantity > 0),
    discount_rate INTEGER NOT NULL DEFAULT 0
        CHECK (discount_rate >= 0 AND discount_rate <= 100),
    tax_rate INTEGER NOT NULL DEFAULT 0
        CHECK (tax_rate >= 0 AND tax_rate <= 100),
    amount INTEGER NOT NULL DEFAULT 0 CHECK (amount >= 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE,
    FOREIGN KEY (budget_item_id) REFERENCES budget_items(id) ON DELETE SET NULL
);

CREATE INDEX idx_receipt_items_receipt_id
    ON receipt_items(receipt_id);

CREATE INDEX idx_receipt_items_budget_item_id
    ON receipt_items(budget_item_id);

CREATE TABLE receipt_reimbursements (
    id TEXT PRIMARY KEY,
    receipt_id TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    amount INTEGER NOT NULL DEFAULT 0 CHECK (amount >= 0),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'paid', 'cancelled')),
    paid_at TEXT,
    paid_by TEXT,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (paid_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_receipt_reimbursements_user_id
    ON receipt_reimbursements(user_id);

CREATE INDEX idx_receipt_reimbursements_status
    ON receipt_reimbursements(status);

CREATE INDEX idx_receipt_reimbursements_paid_at
    ON receipt_reimbursements(paid_at);

INSERT INTO receipts (
    id,
    purchased_at,
    store_name,
    total_amount,
    payment_method,
    paid_by_user_id,
    tag,
    description,
    created_by,
    created_at,
    updated_at
)
SELECT
    id,
    purchased_at,
    '',
    amount,
    payment_method,
    paid_by_user_id,
    tag,
    description,
    created_by,
    created_at,
    updated_at
FROM expenses_legacy;

INSERT INTO receipt_items (
    id,
    receipt_id,
    budget_item_id,
    name,
    unit_price,
    quantity,
    discount_rate,
    tax_rate,
    amount,
    created_at,
    updated_at
)
SELECT
    lower(hex(randomblob(16))),
    id,
    budget_item_id,
    name,
    unit_price,
    quantity,
    discount_rate,
    tax_rate,
    amount,
    created_at,
    updated_at
FROM expenses_legacy;

INSERT INTO receipt_reimbursements (
    id,
    receipt_id,
    user_id,
    amount,
    status,
    paid_at,
    paid_by,
    note,
    created_at,
    updated_at
)
SELECT
    id,
    expense_id,
    user_id,
    amount,
    status,
    paid_at,
    paid_by,
    note,
    created_at,
    updated_at
FROM expense_reimbursements_legacy;

DROP TABLE expense_reimbursements_legacy;
DROP TABLE expenses_legacy;

PRAGMA foreign_keys = ON;
