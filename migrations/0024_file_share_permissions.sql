INSERT INTO permissions (id, key, name, description, category)
VALUES
  (
    'permission-files-share-create',
    'files.share.create',
    '共有リンク作成',
    'ファイルの共有リンクを作成できる',
    'files'
  ),
  (
    'permission-files-share-revoke',
    'files.share.revoke',
    '共有リンク停止',
    'ファイルの共有リンクを停止できる',
    'files'
  );
