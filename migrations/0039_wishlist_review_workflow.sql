INSERT OR IGNORE INTO permissions (
  id,
  key,
  name,
  description,
  category
)
VALUES (
  'permission-wishlist-review',
  'wishlist.review',
  'ほしい物リスト購入判断',
  '購入希望を購入予定・購入済みに変更できる',
  'wishlist'
);

UPDATE wishlist_items
SET status = 'planned', updated_at = CURRENT_TIMESTAMP
WHERE status = 'approved';

UPDATE wishlist_items
SET status = 'requested', updated_at = CURRENT_TIMESTAMP
WHERE status = 'rejected';
