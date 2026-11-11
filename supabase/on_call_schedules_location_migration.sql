-- On call schedules: which location's phone tree a schedule covers (empty
-- means every location), and everyone on call (`users`, [{ id, name }];
-- user_name / user_id keep the first). Reassign Open Work's Calls card
-- shows, per location, who takes calls when there is no covering provider.
--
-- Run after supabase/on_call_schedules_migration.sql. Safe to re-run.

ALTER TABLE public.on_call_schedules ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE public.on_call_schedules ADD COLUMN IF NOT EXISTS users jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Existing schedules: their one user becomes the list.
UPDATE public.on_call_schedules
SET users = jsonb_build_array(jsonb_build_object('id', user_id, 'name', user_name))
WHERE users = '[]'::jsonb AND user_name IS NOT NULL;

-- Demo: Out of Office phone tree on call for the next two months at Mary
-- Health and Downtown Clinic, plus one schedule for every location.
INSERT INTO public.on_call_schedules (id, name, phone_tree_type, from_date, to_date, days, user_name, user_id, location, created_by, created_at)
SELECT v.id, v.name, 'Out of Office', current_date, current_date + 60, '{0,1,2,3,4,5,6}', trim(p.full_name), p.id, v.location, 'Devanshi Sharma', now()
FROM (VALUES
  ('oncall-demo-mary',     'Mary Health OOO phone tree',     'navin%jethwani%', 'Mary Health'),
  ('oncall-demo-downtown', 'Downtown Clinic OOO phone tree', 'abhijit%gupta%',  'Downtown Clinic'),
  ('oncall-demo-all',      'All locations OOO phone tree',   'amar%jagtap%',    NULL)
) AS v(id, name, name_like, location)
JOIN LATERAL (
  SELECT id, full_name FROM public.profiles WHERE full_name ILIKE v.name_like LIMIT 1
) p ON true
ON CONFLICT (id) DO NOTHING;
