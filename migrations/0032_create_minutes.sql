PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS minutes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    meeting_at TEXT NOT NULL,
    location TEXT,
    attendees TEXT NOT NULL DEFAULT '',
    absentees TEXT NOT NULL DEFAULT '',
    agenda TEXT NOT NULL DEFAULT '',
    discussion TEXT NOT NULL DEFAULT '',
    decisions TEXT NOT NULL DEFAULT '',
    next_meeting_at TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_minutes_meeting_at
    ON minutes(meeting_at DESC);

CREATE INDEX IF NOT EXISTS idx_minutes_created_by
    ON minutes(created_by);

CREATE TABLE IF NOT EXISTS minute_tasks (
    minute_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (minute_id, task_id),

    FOREIGN KEY (minute_id)
        REFERENCES minutes(id)
        ON DELETE CASCADE,

    FOREIGN KEY (task_id)
        REFERENCES tasks(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_minute_tasks_task_id
    ON minute_tasks(task_id);

INSERT OR IGNORE INTO permissions (
    id, key, name, description, category
)
VALUES
    (
        'permission-minutes-view',
        'minutes.view',
        '議事録閲覧',
        '議事録を閲覧できる',
        'minutes'
    ),
    (
        'permission-minutes-create',
        'minutes.create',
        '議事録作成',
        '議事録を作成できる',
        'minutes'
    ),
    (
        'permission-minutes-edit',
        'minutes.edit',
        '議事録編集',
        '議事録を編集できる',
        'minutes'
    ),
    (
        'permission-minutes-delete',
        'minutes.delete',
        '議事録削除',
        '議事録を削除できる',
        'minutes'
    );

INSERT OR IGNORE INTO account_role_permissions (
    account_role_id, permission_id, effect
)
SELECT ar.id, p.id, 'allow'
FROM account_roles ar
JOIN permissions p ON p.key = 'minutes.view'
WHERE ar.name = 'classmate';

INSERT OR IGNORE INTO role_permissions (
    role_id, permission_id, effect
)
SELECT r.id, p.id, 'allow'
FROM roles r
JOIN permissions p ON p.key IN (
    'minutes.view',
    'minutes.create',
    'minutes.edit',
    'minutes.delete'
)
WHERE r.name = 'class_representative';
