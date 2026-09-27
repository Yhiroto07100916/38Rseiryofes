PRAGMA foreign_keys = ON;

CREATE TABLE permissions (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_permissions_category
    ON permissions(category);

CREATE TABLE account_role_permissions (
    account_role_id TEXT NOT NULL,
    permission_id TEXT NOT NULL,
    effect TEXT NOT NULL DEFAULT 'allow',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (account_role_id, permission_id),

    FOREIGN KEY (account_role_id)
        REFERENCES account_roles(id)
        ON DELETE CASCADE,

    FOREIGN KEY (permission_id)
        REFERENCES permissions(id)
        ON DELETE CASCADE,

    CHECK (effect IN ('allow', 'deny'))
);

CREATE INDEX idx_account_role_permissions_permission_id
    ON account_role_permissions(permission_id);

CREATE TABLE role_permissions (
    role_id TEXT NOT NULL,
    permission_id TEXT NOT NULL,
    effect TEXT NOT NULL DEFAULT 'allow',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (role_id, permission_id),

    FOREIGN KEY (role_id)
        REFERENCES roles(id)
        ON DELETE CASCADE,

    FOREIGN KEY (permission_id)
        REFERENCES permissions(id)
        ON DELETE CASCADE,

    CHECK (effect IN ('allow', 'deny'))
);

CREATE INDEX idx_role_permissions_permission_id
    ON role_permissions(permission_id);

CREATE TABLE user_permissions (
    user_id TEXT NOT NULL,
    permission_id TEXT NOT NULL,
    effect TEXT NOT NULL DEFAULT 'allow',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (user_id, permission_id),

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    FOREIGN KEY (permission_id)
        REFERENCES permissions(id)
        ON DELETE CASCADE,

    CHECK (effect IN ('allow', 'deny'))
);

CREATE INDEX idx_user_permissions_permission_id
    ON user_permissions(permission_id);

INSERT INTO permissions (
    id,
    key,
    name,
    description,
    category
)
VALUES
    (
        'permission-tasks-view',
        'tasks.view',
        'タスク閲覧',
        'タスクを閲覧できる',
        'tasks'
    ),
    (
        'permission-tasks-create',
        'tasks.create',
        'タスク作成',
        'タスクを作成できる',
        'tasks'
    ),
    (
        'permission-tasks-edit',
        'tasks.edit',
        'タスク編集',
        'タスクを編集できる',
        'tasks'
    ),
    (
        'permission-tasks-delete',
        'tasks.delete',
        'タスク削除',
        'タスクを削除できる',
        'tasks'
    ),
    (
        'permission-tasks-assign',
        'tasks.assign',
        'タスク担当設定',
        'タスクの担当者・係を設定できる',
        'tasks'
    ),
    (
        'permission-tasks-comment',
        'tasks.comment',
        'タスクコメント',
        'タスクにコメントできる',
        'tasks'
    ),

    (
        'permission-schedule-view',
        'schedule.view',
        '予定閲覧',
        '予定・カレンダーを閲覧できる',
        'schedule'
    ),
    (
        'permission-schedule-create',
        'schedule.create',
        '予定作成',
        '予定を作成できる',
        'schedule'
    ),
    (
        'permission-schedule-edit',
        'schedule.edit',
        '予定編集',
        '予定を編集できる',
        'schedule'
    ),
    (
        'permission-schedule-delete',
        'schedule.delete',
        '予定削除',
        '予定を削除できる',
        'schedule'
    ),

    (
        'permission-script-view',
        'script.view',
        '台本閲覧',
        '台本を閲覧できる',
        'script'
    ),
    (
        'permission-script-edit',
        'script.edit',
        '台本編集',
        '台本を編集できる',
        'script'
    ),
    (
        'permission-script-export',
        'script.export',
        '台本出力',
        '台本をPDF等へ出力できる',
        'script'
    ),

    (
        'permission-equipment-view',
        'equipment.view',
        '備品閲覧',
        '備品情報を閲覧できる',
        'equipment'
    ),
    (
        'permission-equipment-create',
        'equipment.create',
        '備品登録',
        '備品を登録できる',
        'equipment'
    ),
    (
        'permission-equipment-edit',
        'equipment.edit',
        '備品編集',
        '備品情報を編集できる',
        'equipment'
    ),
    (
        'permission-equipment-delete',
        'equipment.delete',
        '備品削除',
        '備品を削除できる',
        'equipment'
    ),

    (
        'permission-accounting-view',
        'accounting.view',
        '会計閲覧',
        '会計情報を閲覧できる',
        'accounting'
    ),
    (
        'permission-accounting-create',
        'accounting.create',
        '会計登録',
        '会計情報を登録できる',
        'accounting'
    ),
    (
        'permission-accounting-edit',
        'accounting.edit',
        '会計編集',
        '会計情報を編集できる',
        'accounting'
    ),
    (
        'permission-accounting-approve',
        'accounting.approve',
        '会計承認',
        '会計情報を承認できる',
        'accounting'
    ),

    (
        'permission-members-view',
        'members.view',
        'メンバー閲覧',
        'メンバー情報を閲覧できる',
        'members'
    ),
    (
        'permission-members-create',
        'members.create',
        'メンバー作成',
        'メンバーを作成できる',
        'members'
    ),
    (
        'permission-members-edit',
        'members.edit',
        'メンバー編集',
        'メンバー情報を編集できる',
        'members'
    ),
    (
        'permission-members-delete',
        'members.delete',
        'メンバー削除',
        'メンバーを削除できる',
        'members'
    ),

    (
        'permission-attendance-view',
        'attendance.view',
        '出欠閲覧',
        '出欠情報を閲覧できる',
        'attendance'
    ),
    (
        'permission-attendance-edit',
        'attendance.edit',
        '出欠編集',
        '出欠情報を編集できる',
        'attendance'
    );

INSERT INTO account_role_permissions (
    account_role_id,
    permission_id,
    effect
)
SELECT
    '7b6f7c6e-5f6c-4e3d-9f9b-000000000001',
    id,
    'allow'
FROM permissions;
