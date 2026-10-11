CREATE TABLE budget_sources (
    id TEXT PRIMARY KEY,
    budget_id TEXT NOT NULL,
    source_type TEXT NOT NULL
        CHECK (source_type IN ('class_collection', 'organization_subsidy')),
    amount INTEGER NOT NULL DEFAULT 0
        CHECK (amount >= 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE,
    UNIQUE (budget_id, source_type)
);

CREATE INDEX idx_budget_sources_budget_id
    ON budget_sources(budget_id);

CREATE INDEX idx_budget_sources_source_type
    ON budget_sources(source_type);
