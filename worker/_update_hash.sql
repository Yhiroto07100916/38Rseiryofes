UPDATE users
SET password_hash = 'pbkdf2_sha256$100000$mwdr5xKH8f6iYE2J7UBePA$nGGUoTCQTzXRSM1NH7PcDNOtqggN4XEfo-GorBwvmgM'
WHERE id = 'dev-user-1';
