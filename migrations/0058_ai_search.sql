ALTER TABLE files ADD COLUMN ai_search_item_id TEXT;
CREATE INDEX idx_files_ai_search_item_id ON files(ai_search_item_id);
