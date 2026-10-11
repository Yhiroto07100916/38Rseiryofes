CREATE TABLE receipt_files (
    receipt_id TEXT NOT NULL,
    file_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (receipt_id, file_id),
    FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE INDEX idx_receipt_files_file_id
    ON receipt_files(file_id);
