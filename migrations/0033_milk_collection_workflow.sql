PRAGMA foreign_keys = ON;
CREATE TABLE milk_collection_requests (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, store_name TEXT NOT NULL, address TEXT, contact_info TEXT,
 expected_quantity INTEGER, proposal_reason TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','changes_requested','representative_reviewed','chief_review_pending','chief_approved','chief_rejected','contact_pending','contacted','store_approved','store_rejected','scheduling','collecting','completed','cancelled')),
 representative_note TEXT, chief_review_result TEXT CHECK(chief_review_result IS NULL OR chief_review_result IN ('approved','rejected','pending')),
 chief_review_note TEXT, store_contact_result TEXT CHECK(store_contact_result IS NULL OR store_contact_result IN ('approved','rejected','no_answer','pending')),
 store_contact_note TEXT, scheduled_at TEXT, first_collection_at TEXT, collected_quantity INTEGER,
 created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE RESTRICT
);
CREATE INDEX idx_milk_collection_status ON milk_collection_requests(status,updated_at DESC);
CREATE INDEX idx_milk_collection_created_by ON milk_collection_requests(created_by,created_at DESC);
CREATE TABLE milk_collection_comments (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL, author_id TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(request_id) REFERENCES milk_collection_requests(id) ON DELETE CASCADE,
 FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE RESTRICT
);
CREATE INDEX idx_milk_collection_comments_request ON milk_collection_comments(request_id,created_at);
CREATE TABLE milk_collection_history (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL, actor_id TEXT NOT NULL, action TEXT NOT NULL, from_status TEXT, to_status TEXT, details TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(request_id) REFERENCES milk_collection_requests(id) ON DELETE CASCADE,
 FOREIGN KEY(actor_id) REFERENCES users(id) ON DELETE RESTRICT
);
CREATE INDEX idx_milk_collection_history_request ON milk_collection_history(request_id,created_at DESC);
INSERT OR IGNORE INTO permissions(id,key,name,description,category) VALUES
('permission-milk-collection-view','milk_collection.view','牛乳パック受け取り閲覧','受け取り申請と進捗を閲覧できる','milk_collection'),
('permission-milk-collection-create','milk_collection.create','牛乳パック受け取り申請','受け取り候補を申請できる','milk_collection'),
('permission-milk-collection-review','milk_collection.review','牛乳パック申請レビュー','クラ代として確認済み・修正依頼を行える','milk_collection'),
('permission-milk-collection-submit-to-chief','milk_collection.submit_to_chief','牛乳パック審議依頼','チーフ会への審議依頼を記録できる','milk_collection'),
('permission-milk-collection-record-review','milk_collection.record_review','牛乳パック審議結果記録','チーフ会の審議結果を記録できる','milk_collection'),
('permission-milk-collection-record-contact','milk_collection.record_contact','牛乳パック店舗連絡記録','店舗への電話結果を記録できる','milk_collection'),
('permission-milk-collection-manage-schedule','milk_collection.manage_schedule','牛乳パック受け取り管理','受け取り日程と実績を管理できる','milk_collection'),
('permission-milk-collection-comment','milk_collection.comment','牛乳パックコメント','申請にコメントできる','milk_collection');

-- 基本閲覧・提案・コメントはクラス全体に付与し、レビューはクラ代に付与する。
INSERT OR IGNORE INTO account_role_permissions (account_role_id, permission_id, effect)
SELECT ar.id, p.id, 'allow'
FROM account_roles ar
JOIN permissions p ON p.key IN (
  'milk_collection.view',
  'milk_collection.create',
  'milk_collection.comment'
)
WHERE ar.name = 'classmate';

INSERT OR IGNORE INTO role_permissions (role_id, permission_id, effect)
SELECT r.id, p.id, 'allow'
FROM roles r
JOIN permissions p ON p.key IN (
  'milk_collection.review',
  'milk_collection.submit_to_chief'
)
WHERE r.name = 'class_representative';
