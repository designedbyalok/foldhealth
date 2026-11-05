-- TOC AI Tasks: idempotent program tasks keyed by source_key so agent-
-- generated follow-ups persist per patient and survive reload.

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS source_key TEXT,
  ADD COLUMN IF NOT EXISTS attachments INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comments INTEGER DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS tasks_source_key_unique
  ON tasks (source_key)
  WHERE source_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS tasks_toc_patient_idx
  ON tasks (program_code, patient_id)
  WHERE program_code = 'TOC';
