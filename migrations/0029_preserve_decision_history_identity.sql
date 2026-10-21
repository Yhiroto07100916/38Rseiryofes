ALTER TABLE decision_history
ADD COLUMN original_decision_id TEXT;

UPDATE decision_history
SET original_decision_id = decision_id
WHERE decision_id IS NOT NULL;

CREATE INDEX idx_decision_history_original_decision
ON decision_history(original_decision_id, created_at DESC);
