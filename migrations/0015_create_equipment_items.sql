CREATE TABLE equipment_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'equipment',
    description TEXT,
    required_quantity INTEGER NOT NULL DEFAULT 1,
    prepared_quantity INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'not_started',
    owner_user_id TEXT,
    role_id TEXT,
    storage_location TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_equipment_items_category
    ON equipment_items(category);

CREATE INDEX idx_equipment_items_status
    ON equipment_items(status);

CREATE INDEX idx_equipment_items_owner_user_id
    ON equipment_items(owner_user_id);

CREATE INDEX idx_equipment_items_role_id
    ON equipment_items(role_id);

CREATE INDEX idx_equipment_items_updated_at
    ON equipment_items(updated_at);
