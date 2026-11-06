-- Local development only. Do not apply this seed to production.
-- Login ID: 2801
-- The password is stored as a PBKDF2-SHA256 hash compatible with worker/src/lib/password.ts.

INSERT INTO users (
    id,
    student_number,
    name,
    nickname,
    password_hash
)
SELECT
    'd1b7f9a4-2c83-4e61-9a72-280100000001',
    '2801',
    'localadmin',
    'localadmin',
    'pbkdf2_sha256$100000$2DP4cUjHV9TKR_S4h3NTUA$xyIde-ZLcczrx1uKdgRWtBWGZx0_sn10x2xk9VtymQY'
WHERE NOT EXISTS (
    SELECT 1
    FROM users
    WHERE student_number = '2801'
)
AND NOT EXISTS (
    SELECT 1
    FROM users
    WHERE id = 'd1b7f9a4-2c83-4e61-9a72-280100000001'
);

INSERT OR IGNORE INTO user_account_roles (
    user_id,
    account_role_id
)
SELECT
    u.id,
    ar.id
FROM users u
INNER JOIN account_roles ar
    ON ar.name = 'admin'
WHERE u.id = 'd1b7f9a4-2c83-4e61-9a72-280100000001'
  AND u.student_number = '2801';
