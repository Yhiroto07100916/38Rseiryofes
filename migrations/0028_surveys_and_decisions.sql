PRAGMA foreign_keys = ON;

CREATE TABLE surveys (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    response_type TEXT NOT NULL DEFAULT 'single_choice'
        CHECK (response_type IN ('single_choice', 'multiple_choice', 'free_text')),
    is_anonymous INTEGER NOT NULL DEFAULT 0
        CHECK (is_anonymous IN (0, 1)),
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'closed')),
    starts_at TEXT,
    deadline_at TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_surveys_status_deadline
    ON surveys(status, deadline_at);

CREATE INDEX idx_surveys_created_at
    ON surveys(created_at DESC);

CREATE TABLE survey_options (
    id TEXT PRIMARY KEY,
    survey_id TEXT NOT NULL,
    label TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (survey_id) REFERENCES surveys(id)
        ON DELETE CASCADE,
    UNIQUE (survey_id, sort_order)
);

CREATE INDEX idx_survey_options_survey
    ON survey_options(survey_id, sort_order);

CREATE TABLE survey_participation (
    survey_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (survey_id, user_id),
    FOREIGN KEY (survey_id) REFERENCES surveys(id)
        ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE TABLE survey_responses (
    id TEXT PRIMARY KEY,
    survey_id TEXT NOT NULL,
    respondent_id TEXT,
    text_answer TEXT,
    submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (survey_id) REFERENCES surveys(id)
        ON DELETE CASCADE,
    FOREIGN KEY (respondent_id) REFERENCES users(id)
        ON DELETE RESTRICT
);

CREATE UNIQUE INDEX idx_survey_responses_named_respondent
    ON survey_responses(survey_id, respondent_id)
    WHERE respondent_id IS NOT NULL;

CREATE INDEX idx_survey_responses_survey
    ON survey_responses(survey_id, submitted_at);

CREATE TABLE survey_response_options (
    response_id TEXT NOT NULL,
    option_id TEXT NOT NULL,
    PRIMARY KEY (response_id, option_id),
    FOREIGN KEY (response_id) REFERENCES survey_responses(id)
        ON DELETE CASCADE,
    FOREIGN KEY (option_id) REFERENCES survey_options(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_survey_response_options_option
    ON survey_response_options(option_id);

CREATE TABLE decisions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    rationale TEXT,
    decided_at TEXT NOT NULL,
    decision_maker TEXT,
    meeting_name TEXT,
    survey_id TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (survey_id) REFERENCES surveys(id)
        ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_decisions_decided_at
    ON decisions(decided_at DESC);

CREATE INDEX idx_decisions_survey
    ON decisions(survey_id);

CREATE TABLE decision_tasks (
    decision_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (decision_id, task_id),
    FOREIGN KEY (decision_id) REFERENCES decisions(id)
        ON DELETE CASCADE,
    FOREIGN KEY (task_id) REFERENCES tasks(id)
        ON DELETE CASCADE
);

CREATE TABLE decision_files (
    decision_id TEXT NOT NULL,
    file_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (decision_id, file_id),
    FOREIGN KEY (decision_id) REFERENCES decisions(id)
        ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES files(id)
        ON DELETE CASCADE
);

CREATE TABLE decision_history (
    id TEXT PRIMARY KEY,
    decision_id TEXT,
    actor_id TEXT NOT NULL,
    action TEXT NOT NULL
        CHECK (action IN ('created', 'updated', 'deleted')),
    before_data TEXT,
    after_data TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (decision_id) REFERENCES decisions(id)
        ON DELETE SET NULL,
    FOREIGN KEY (actor_id) REFERENCES users(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_decision_history_decision
    ON decision_history(decision_id, created_at DESC);

INSERT OR IGNORE INTO permissions (
    id, key, name, description, category
)
VALUES
    ('permission-surveys-view', 'surveys.view',
     'アンケート閲覧', '公開されたアンケートを閲覧できる', 'surveys'),
    ('permission-surveys-create', 'surveys.create',
     'アンケート作成', 'アンケートを作成できる', 'surveys'),
    ('permission-surveys-edit', 'surveys.edit',
     'アンケート編集', 'アンケートを編集できる', 'surveys'),
    ('permission-surveys-delete', 'surveys.delete',
     'アンケート削除', 'アンケートを削除できる', 'surveys'),
    ('permission-surveys-respond', 'surveys.respond',
     'アンケート回答', 'アンケートに回答できる', 'surveys'),
    ('permission-surveys-results-view', 'surveys.results.view',
     'アンケート結果閲覧', 'アンケートの集計結果を閲覧できる', 'surveys'),
    ('permission-decisions-view', 'decisions.view',
     '意思決定記録閲覧', '意思決定記録を閲覧できる', 'decisions'),
    ('permission-decisions-create', 'decisions.create',
     '意思決定記録作成', '意思決定記録を作成できる', 'decisions'),
    ('permission-decisions-edit', 'decisions.edit',
     '意思決定記録編集', '意思決定記録を編集できる', 'decisions'),
    ('permission-decisions-delete', 'decisions.delete',
     '意思決定記録削除', '意思決定記録を削除できる', 'decisions');

INSERT OR IGNORE INTO account_role_permissions (
    account_role_id, permission_id, effect
)
SELECT ar.id, p.id, 'allow'
FROM account_roles ar
JOIN permissions p ON p.key IN (
    'surveys.view',
    'surveys.respond',
    'decisions.view'
)
WHERE ar.name = 'classmate';

INSERT OR IGNORE INTO role_permissions (
    role_id, permission_id, effect
)
SELECT r.id, p.id, 'allow'
FROM roles r
JOIN permissions p ON p.key IN (
    'surveys.view',
    'surveys.create',
    'surveys.edit',
    'surveys.delete',
    'surveys.respond',
    'surveys.results.view',
    'decisions.view',
    'decisions.create',
    'decisions.edit',
    'decisions.delete'
)
WHERE r.name = 'class_representative';
