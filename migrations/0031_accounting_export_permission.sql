INSERT OR IGNORE INTO permissions (
  id,
  key,
  name,
  description,
  category
)
VALUES (
  'permission-accounting-export',
  'accounting.export',
  '会計書類出力',
  '会計情報をCSVやPDFなどの書類に出力できる',
  'accounting'
);
