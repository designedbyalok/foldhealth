-- Rule templates for the "Import Rule" drawer in Population Groups.
-- Customers can pick a pre-built rule to bootstrap a new Dynamic group,
-- then customise it in the builder. Templates are read-only for app
-- users: seeded by the Fold team, displayed in a Drawer, never edited
-- in the UI.

CREATE TABLE IF NOT EXISTS pop_group_rule_templates (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  description text,
  category   text NOT NULL DEFAULT 'General',
  rule       jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pop_group_rule_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON pop_group_rule_templates;
CREATE POLICY "Allow all" ON pop_group_rule_templates FOR SELECT TO authenticated USING (true);

-- Also add a `status` column to population_groups (draft / active):
ALTER TABLE population_groups ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
