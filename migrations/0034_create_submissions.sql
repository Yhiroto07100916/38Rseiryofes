PRAGMA foreign_keys = ON;

CREATE TABLE submissions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    destination TEXT NOT NULL,
    due_at TEXT,
    assigned_role_id TEXT,
    status TEXT NOT NULL DEFAULT 'preparing',
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (assigned_role_id)
        REFERENCES roles(id)
        ON DELETE SET NULL,

    FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    CHECK (
        status IN (
            'preparing',
            'ready_to_submit',
            'submitted',
            'under_review',
            'changes_requested',
            'resubmitted',
            'completed',
            'cancelled'
        )
    )
);

CREATE INDEX idx_submissions_status
    ON submissions(status, due_at);

CREATE INDEX idx_submissions_due_at
    ON submissions(due_at);

CREATE INDEX idx_submissions_assigned_role
    ON submissions(assigned_role_id);

CREATE INDEX idx_submissions_created_by
    ON submissions(created_by);


CREATE TABLE submission_records (
    id TEXT PRIMARY KEY,
    submission_id TEXT NOT NULL,
    attempt_number INTEGER NOT NULL,
    submitted_by TEXT NOT NULL,
    submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    note TEXT,

    FOREIGN KEY (submission_id)
        REFERENCES submissions(id)
        ON DELETE CASCADE,

    FOREIGN KEY (submitted_by)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    UNIQUE (submission_id, attempt_number),
    CHECK (attempt_number >= 1)
);

CREATE INDEX idx_submission_records_submission
    ON submission_records(submission_id, attempt_number DESC);


CREATE TABLE submission_record_files (
    record_id TEXT NOT NULL,
    file_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (record_id, file_id),

    FOREIGN KEY (record_id)
        REFERENCES submission_records(id)
        ON DELETE CASCADE,

    FOREIGN KEY (file_id)
        REFERENCES files(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_submission_record_files_file
    ON submission_record_files(file_id);


CREATE TABLE submission_history (
    id TEXT PRIMARY KEY,
    submission_id TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    action TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (submission_id)
        REFERENCES submissions(id)
        ON DELETE CASCADE,

    FOREIGN KEY (actor_id)
        REFERENCES users(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_submission_history_submission
    ON submission_history(submission_id, created_at DESC);


INSERT OR IGNORE INTO permissions (
    id, key, name, description, category
)
VALUES
    (
        'permission-submissions-view',
        'submissions.view',
        '提出物閲覧',
        '提出物と提出状況を閲覧できる',
        'submissions'
    ),
    (
        'permission-submissions-create',
        'submissions.create',
        '提出物作成',
        '提出物を作成できる',
        'submissions'
    ),
    (
        'permission-submissions-edit',
        'submissions.edit',
        '提出物編集',
        '提出物の内容や期限を編集できる',
        'submissions'
    ),
    (
        'permission-submissions-submit',
        'submissions.submit',
        '提出記録',
        '提出物の提出と再提出を記録できる',
        'submissions'
    ),
    (
        'permission-submissions-review',
        'submissions.review',
        '提出物確認',
        '提出物の確認結果や修正依頼を記録できる',
        'submissions'
    );


INSERT OR IGNORE INTO account_role_permissions (
    account_role_id,
    permission_id,
    effect
)
SELECT
    ar.id,
    p.id,
    'allow'
FROM account_roles ar
JOIN permissions p
    ON p.key = 'submissions.view'
WHERE ar.name = 'classmate';


INSERT OR IGNORE INTO role_permissions (
    role_id,
    permission_id,
    effect
)
SELECT
    r.id,
    p.id,
    'allow'
FROM roles r
JOIN permissions p
    ON p.key IN (
        'submissions.view',
        'submissions.create',
        'submissions.edit',
        'submissions.submit',
        'submissions.review'
    )
WHERE r.name = 'class_representative';
