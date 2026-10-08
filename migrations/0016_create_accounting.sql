CREATE TABLE budgets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    amount INTEGER NOT NULL DEFAULT 0 CHECK (amount >= 0),
    description TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_budgets_created_by
    ON budgets(created_by);

CREATE INDEX idx_budgets_updated_at
    ON budgets(updated_at);


CREATE TABLE budget_items (
    id TEXT PRIMARY KEY,
    budget_id TEXT NOT NULL,
    name TEXT NOT NULL,
    budgeted_amount INTEGER NOT NULL DEFAULT 0 CHECK (budgeted_amount >= 0),
    category TEXT,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE
);

CREATE INDEX idx_budget_items_budget_id
    ON budget_items(budget_id);

CREATE INDEX idx_budget_items_category
    ON budget_items(category);


CREATE TABLE expenses (
    id TEXT PRIMARY KEY,
    budget_item_id TEXT,
    name TEXT NOT NULL,
    unit_price INTEGER NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
    quantity REAL NOT NULL DEFAULT 1 CHECK (quantity > 0),
    discount_rate INTEGER NOT NULL DEFAULT 0 CHECK (discount_rate >= 0 AND discount_rate <= 100),
    tax_rate INTEGER NOT NULL DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 100),
    amount INTEGER NOT NULL DEFAULT 0 CHECK (amount >= 0),
    purchased_at TEXT NOT NULL,
    paid_by_user_id TEXT,
    payment_method TEXT NOT NULL DEFAULT 'budget'
        CHECK (payment_method IN ('budget', 'advance')),
    tag TEXT,
    description TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (budget_item_id) REFERENCES budget_items(id) ON DELETE SET NULL,
    FOREIGN KEY (paid_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id),
    CHECK (
        payment_method = 'budget'
        OR paid_by_user_id IS NOT NULL
    )
);

CREATE INDEX idx_expenses_budget_item_id
    ON expenses(budget_item_id);

CREATE INDEX idx_expenses_purchased_at
    ON expenses(purchased_at);

CREATE INDEX idx_expenses_paid_by_user_id
    ON expenses(paid_by_user_id);

CREATE INDEX idx_expenses_payment_method
    ON expenses(payment_method);

CREATE INDEX idx_expenses_tag
    ON expenses(tag);

CREATE INDEX idx_expenses_updated_at
    ON expenses(updated_at);


CREATE TABLE expense_reimbursements (
    id TEXT PRIMARY KEY,
    expense_id TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    amount INTEGER NOT NULL DEFAULT 0 CHECK (amount >= 0),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'paid', 'cancelled')),
    paid_at TEXT,
    paid_by TEXT,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (paid_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_expense_reimbursements_user_id
    ON expense_reimbursements(user_id);

CREATE INDEX idx_expense_reimbursements_status
    ON expense_reimbursements(status);

CREATE INDEX idx_expense_reimbursements_paid_at
    ON expense_reimbursements(paid_at);
