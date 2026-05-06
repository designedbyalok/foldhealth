-- ============================================================
-- Tasks v2: subtasks, pools, mentions, completed_at, audit log
-- ============================================================

-- 1. New columns on tasks
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS parent_task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS pool TEXT,
  ADD COLUMN IF NOT EXISTS mentions TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS tasks_parent_idx ON tasks (parent_task_id);
CREATE INDEX IF NOT EXISTS tasks_pool_idx ON tasks (pool);

-- 2. Audit log table
CREATE TABLE IF NOT EXISTS task_audit_log (
  id SERIAL PRIMARY KEY,
  task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  user_name TEXT,
  user_id UUID,
  action_type TEXT NOT NULL,
  field_name TEXT,
  from_value TEXT,
  to_value TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS task_audit_log_task_idx ON task_audit_log (task_id, created_at);

ALTER TABLE task_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for task_audit_log" ON task_audit_log FOR ALL USING (true) WITH CHECK (true);

-- 3. Task pools table (defines available pools)
CREATE TABLE IF NOT EXISTS task_pools (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE task_pools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for task_pools" ON task_pools FOR ALL USING (true) WITH CHECK (true);

INSERT INTO task_pools (name, description) VALUES
  ('Patient Outreach', 'Tasks queued for patient outreach team to claim'),
  ('Care Management', 'Care management workflows awaiting clinical staff'),
  ('Documentation', 'Chart review and documentation tasks'),
  ('Follow-up', 'Post-visit follow-up tasks awaiting assignment')
ON CONFLICT (name) DO NOTHING;
