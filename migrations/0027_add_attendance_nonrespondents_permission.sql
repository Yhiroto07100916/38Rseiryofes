INSERT OR IGNORE INTO permissions (
  id,
  key,
  name,
  description,
  category
)
VALUES (
  'permission-attendance-nonrespondents-view',
  'attendance.nonrespondents.view',
  '未回答者閲覧',
  '出欠を未回答または未定としているユーザーを閲覧できる',
  'attendance'
);

INSERT OR IGNORE INTO account_role_permissions (
  account_role_id,
  permission_id,
  effect
)
VALUES (
  '7b6f7c6e-5f6c-4e3d-9f9b-000000000001',
  'permission-attendance-nonrespondents-view',
  'allow'
);
