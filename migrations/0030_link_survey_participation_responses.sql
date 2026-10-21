PRAGMA foreign_keys = ON;

-- 参加記録から、そのユーザー自身の回答レコードを特定できるようにする。
ALTER TABLE survey_participation
ADD COLUMN response_id TEXT REFERENCES survey_responses(id);

-- 過去の回答は、アンケートIDと送信日時が一致し、
-- 同じ日時の回答が1件だけ存在する場合に限り紐付ける。
-- 複数件ある場合は、誤った回答を紐付けないよう対象外にする。
UPDATE survey_participation
SET response_id = (
    SELECT r.id
    FROM survey_responses r
    WHERE r.survey_id = survey_participation.survey_id
      AND r.submitted_at = survey_participation.submitted_at
    LIMIT 1
)
WHERE (
    SELECT COUNT(*)
    FROM survey_responses r
    WHERE r.survey_id = survey_participation.survey_id
      AND r.submitted_at = survey_participation.submitted_at
) = 1;

-- 1つの回答が複数の参加記録に紐付くことを防止する。
CREATE UNIQUE INDEX idx_survey_participation_response
ON survey_participation(response_id)
WHERE response_id IS NOT NULL;
