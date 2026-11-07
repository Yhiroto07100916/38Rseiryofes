-- Receipt files cannot be shared with other domains.
CREATE TRIGGER trg_receipt_files_exclusive_insert
BEFORE INSERT ON receipt_files
WHEN
  EXISTS (SELECT 1 FROM task_files WHERE file_id = NEW.file_id)
  OR EXISTS (SELECT 1 FROM decision_files WHERE file_id = NEW.file_id)
  OR EXISTS (
    SELECT 1
    FROM submission_record_files srf
    WHERE srf.file_id = NEW.file_id
  )
BEGIN
  SELECT RAISE(ABORT, 'FILE_LINK_CONFLICT: file is linked to another domain');
END;

CREATE TRIGGER trg_receipt_files_exclusive_update
BEFORE UPDATE OF receipt_id, file_id ON receipt_files
WHEN
  EXISTS (SELECT 1 FROM task_files WHERE file_id = NEW.file_id)
  OR EXISTS (SELECT 1 FROM decision_files WHERE file_id = NEW.file_id)
  OR EXISTS (
    SELECT 1
    FROM submission_record_files srf
    WHERE srf.file_id = NEW.file_id
  )
BEGIN
  SELECT RAISE(ABORT, 'FILE_LINK_CONFLICT: file is linked to another domain');
END;

-- Task files cannot be shared with other domains.
CREATE TRIGGER trg_task_files_exclusive_insert
BEFORE INSERT ON task_files
WHEN
  EXISTS (SELECT 1 FROM receipt_files WHERE file_id = NEW.file_id)
  OR EXISTS (SELECT 1 FROM decision_files WHERE file_id = NEW.file_id)
  OR EXISTS (
    SELECT 1
    FROM submission_record_files srf
    WHERE srf.file_id = NEW.file_id
  )
BEGIN
  SELECT RAISE(ABORT, 'FILE_LINK_CONFLICT: file is linked to another domain');
END;

CREATE TRIGGER trg_task_files_exclusive_update
BEFORE UPDATE OF task_id, file_id ON task_files
WHEN
  EXISTS (SELECT 1 FROM receipt_files WHERE file_id = NEW.file_id)
  OR EXISTS (SELECT 1 FROM decision_files WHERE file_id = NEW.file_id)
  OR EXISTS (
    SELECT 1
    FROM submission_record_files srf
    WHERE srf.file_id = NEW.file_id
  )
BEGIN
  SELECT RAISE(ABORT, 'FILE_LINK_CONFLICT: file is linked to another domain');
END;

-- Decision files cannot be shared with other domains.
CREATE TRIGGER trg_decision_files_exclusive_insert
BEFORE INSERT ON decision_files
WHEN
  EXISTS (SELECT 1 FROM receipt_files WHERE file_id = NEW.file_id)
  OR EXISTS (SELECT 1 FROM task_files WHERE file_id = NEW.file_id)
  OR EXISTS (
    SELECT 1
    FROM submission_record_files srf
    WHERE srf.file_id = NEW.file_id
  )
BEGIN
  SELECT RAISE(ABORT, 'FILE_LINK_CONFLICT: file is linked to another domain');
END;

CREATE TRIGGER trg_decision_files_exclusive_update
BEFORE UPDATE OF decision_id, file_id ON decision_files
WHEN
  EXISTS (SELECT 1 FROM receipt_files WHERE file_id = NEW.file_id)
  OR EXISTS (SELECT 1 FROM task_files WHERE file_id = NEW.file_id)
  OR EXISTS (
    SELECT 1
    FROM submission_record_files srf
    WHERE srf.file_id = NEW.file_id
  )
BEGIN
  SELECT RAISE(ABORT, 'FILE_LINK_CONFLICT: file is linked to another domain');
END;

-- Submission files may be reused across attempts of the same submission,
-- but cannot be shared with another submission or another domain.
CREATE TRIGGER trg_submission_files_exclusive_insert
BEFORE INSERT ON submission_record_files
WHEN
  EXISTS (SELECT 1 FROM receipt_files WHERE file_id = NEW.file_id)
  OR EXISTS (SELECT 1 FROM task_files WHERE file_id = NEW.file_id)
  OR EXISTS (SELECT 1 FROM decision_files WHERE file_id = NEW.file_id)
  OR EXISTS (
    SELECT 1
    FROM submission_record_files existing_srf
    JOIN submission_records existing_record
      ON existing_record.id = existing_srf.record_id
    JOIN submission_records new_record
      ON new_record.id = NEW.record_id
    WHERE existing_srf.file_id = NEW.file_id
      AND existing_record.submission_id != new_record.submission_id
  )
BEGIN
  SELECT RAISE(ABORT, 'FILE_LINK_CONFLICT: file is linked to another domain or submission');
END;

CREATE TRIGGER trg_submission_files_exclusive_update
BEFORE UPDATE OF record_id, file_id ON submission_record_files
WHEN
  EXISTS (SELECT 1 FROM receipt_files WHERE file_id = NEW.file_id)
  OR EXISTS (SELECT 1 FROM task_files WHERE file_id = NEW.file_id)
  OR EXISTS (SELECT 1 FROM decision_files WHERE file_id = NEW.file_id)
  OR EXISTS (
    SELECT 1
    FROM submission_record_files existing_srf
    JOIN submission_records existing_record
      ON existing_record.id = existing_srf.record_id
    JOIN submission_records new_record
      ON new_record.id = NEW.record_id
    WHERE existing_srf.file_id = NEW.file_id
      AND NOT (
        existing_srf.record_id = OLD.record_id
        AND existing_srf.file_id = OLD.file_id
      )
      AND existing_record.submission_id != new_record.submission_id
  )
BEGIN
  SELECT RAISE(ABORT, 'FILE_LINK_CONFLICT: file is linked to another domain or submission');
END;
