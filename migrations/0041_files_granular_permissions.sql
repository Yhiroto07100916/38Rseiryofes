INSERT OR IGNORE INTO permissions (id, key, name, description, category)
VALUES
  ('permission-files-view', 'files.view', 'ファイル閲覧', 'ファイル一覧とプレビューを閲覧できる', 'files'),
  ('permission-files-download', 'files.download', 'ファイルダウンロード', 'ファイルをダウンロードできる', 'files'),
  ('permission-files-upload', 'files.upload', 'ファイルアップロード', 'ファイルをアップロードできる', 'files'),
  ('permission-files-move', 'files.move', 'ファイル移動', 'ファイルを別のフォルダへ移動できる', 'files'),
  ('permission-files-archive', 'files.archive', 'ファイルアーカイブ', 'ファイルをアーカイブできる', 'files'),
  ('permission-files-restore', 'files.restore', 'ファイル復元', 'アーカイブ済みファイルを復元できる', 'files'),
  ('permission-files-delete', 'files.delete', 'ファイル完全削除', 'アーカイブ済みファイルを完全削除できる', 'files'),
  ('permission-files-categories-manage', 'files.categories.manage', 'ファイルカテゴリ管理', 'カテゴリを追加・編集・無効化できる', 'files'),
  ('permission-files-folders-create', 'files.folders.create', 'フォルダ作成', 'ファイルフォルダを作成できる', 'files'),
  ('permission-files-folders-manage', 'files.folders.manage', 'フォルダ管理', 'すべてのフォルダを編集・削除できる', 'files'),
  ('permission-files-ai-search-manage', 'files.ai_search.manage', 'AI検索管理', '既存資料の登録・失敗分の再試行・状態同期ができる', 'files');

INSERT OR IGNORE INTO account_role_permissions (account_role_id, permission_id, effect)
SELECT ar.id, p.id, 'allow'
FROM account_roles ar
JOIN permissions p ON p.key IN (
  'files.view', 'files.download', 'files.upload', 'files.folders.create'
)
WHERE ar.name IN ('classmate', 'class_representative');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id, effect)
SELECT r.id, p.id, 'allow'
FROM roles r
JOIN permissions p ON p.key IN (
  'files.view', 'files.download', 'files.upload', 'files.folders.create',
  'files.move', 'files.archive', 'files.restore', 'files.categories.manage',
  'files.folders.manage', 'files.ai_search.manage'
)
WHERE r.name = 'class_representative';
