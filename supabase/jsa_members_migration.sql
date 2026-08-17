-- JSA (Joint Screening Assessment) worklist backing table.
-- Mirrors the awv_members schema exactly so the store's fetch mapper (which
-- also reads support_name/support_status/cohort/…) can point at either
-- table without branching. RLS follows the recently-narrowed pattern —
-- authenticated-only reads and writes.

CREATE TABLE IF NOT EXISTS public.jsa_members (
  id                  text PRIMARY KEY,
  member_id           text,
  name                text,
  initials            text,
  gender              text,
  age                 text,
  outreach            integer,
  tasks               integer,
  create_date         text,
  due_label           text,
  due_color           text,
  support_name        text,
  support_status      text,
  cohort              text,
  risk_level          text,
  decile              text,
  advillness          integer,
  frailty             integer,
  language            text DEFAULT 'en'
);

ALTER TABLE public.jsa_members ENABLE ROW LEVEL SECURITY;

-- Reads are open to any signed-in staff member (a worklist is a shared roster),
-- but writes require an active staff profile. `FOR ALL USING (true)` let any
-- authenticated session insert, rewrite or delete the whole roster — including
-- an `Invited` account that had never been activated. Same shape as
-- program_documents_migration.sql.
DROP POLICY IF EXISTS "Allow all for jsa_members" ON public.jsa_members;

DROP POLICY IF EXISTS jsa_members_select ON public.jsa_members;
CREATE POLICY jsa_members_select
  ON public.jsa_members FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS jsa_members_insert ON public.jsa_members;
CREATE POLICY jsa_members_insert
  ON public.jsa_members FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.status = 'Active'
  ));

DROP POLICY IF EXISTS jsa_members_update ON public.jsa_members;
CREATE POLICY jsa_members_update
  ON public.jsa_members FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.status = 'Active'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.status = 'Active'
  ));

DROP POLICY IF EXISTS jsa_members_delete ON public.jsa_members;
CREATE POLICY jsa_members_delete
  ON public.jsa_members FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.status = 'Active'
  ));

INSERT INTO public.jsa_members (
  id, member_id, name, initials, gender, age,
  outreach, tasks,
  create_date, due_label, due_color,
  support_name, support_status,
  cohort,
  risk_level, decile, advillness, frailty,
  language
) VALUES
  ('jsa-1', 'M-JSA-1001', 'John Smith', 'JS', 'M', '68y 2m', 2, 2, '08/20/2026', 'Due in 5D', 'var(--status-info)', 'C. Adams', 'Open', 'AWV', 'High', '8', 3, 2, 'en'),
  ('jsa-2', 'M-JSA-1002', 'Mary Johnson', 'MJ', 'F', '71y 5m', 4, 1, '07/25/2026', 'Overdue: 5D', 'var(--status-error)', 'D. Baker', 'Attempted', 'AWV', 'Medium', '7', 4, 3, 'en'),
  ('jsa-3', 'M-JSA-1003', 'William Davis', 'WD', 'M', '65y 9m', 1, 3, '09/05/2026', 'Due in 21D', 'var(--neutral-200)', 'E. Clarke', 'Engaged', 'APE', 'High', '10', 6, 4, 'en'),
  ('jsa-4', 'M-JSA-1004', 'Linda Martinez', 'LM', 'F', '74y 1m', 3, 2, '08/10/2026', 'Due Today', 'var(--status-warning)', 'F. Davies', 'Engaged - Requires Follow Up', 'AWV', 'High', '9', 5, 5, 'en'),
  ('jsa-5', 'M-JSA-1005', 'James Wilson', 'JW', 'M', '69y 4m', 5, 0, '06/30/2026', 'Unable to Reach', 'var(--status-success)', 'G. Evans', 'Unable to Reach', 'APE', 'Medium', '8', 3, 3, 'en'),
  ('jsa-6', 'M-JSA-1006', 'Patricia Taylor', 'PT', 'F', '62y 7m', 0, 1, '09/15/2026', 'Due in 30D', 'var(--neutral-200)', 'C. Adams', 'New', 'AWV', 'Low', '5', 1, 1, 'en'),
  ('jsa-7', 'M-JSA-1007', 'Robert Anderson', 'RA', 'M', '77y 0m', 2, 1, '08/14/2026', 'Due in 4D', 'var(--status-info)', 'H. Foster', 'Open', 'APE', 'Low', '6', 2, 1, 'en'),
  ('jsa-8', 'M-JSA-1008', 'Jennifer Thomas', 'JT', 'F', '61y 3m', 4, 2, '08/20/2026', 'Due in 10D', 'var(--status-warning)', 'I. Garcia', 'Attempted', 'AWV', 'Medium', '9', 4, 2, 'en'),
  ('jsa-9', 'M-JSA-1009', 'Elizabeth White', 'EW', 'F', '64y 6m', 0, 0, '10/01/2026', 'Due in 45D', 'var(--neutral-200)', NULL, 'New', 'AWV', 'Low', '4', 1, 1, 'en'),
  ('jsa-10', 'M-JSA-1010', 'Barbara Harris', 'BH', 'F', '70y 8m', 1, 1, '09/05/2026', 'Due in 22D', 'var(--neutral-200)', 'J. Hughes', 'Open', 'AWV', 'Medium', '6', 2, 2, 'en'),
  ('jsa-11', 'M-JSA-1011', 'Richard Martin', 'RM', 'M', '76y 2m', 6, 2, '07/15/2026', 'Unable to Reach', 'var(--status-error)', 'D. Baker', 'Unable to Reach', 'APE', 'High', '8', 4, 4, 'en'),
  ('jsa-12', 'M-JSA-1012', 'Susan Moore', 'SM', 'F', '63y 4m', 2, 1, '08/28/2026', 'Due in 18D', 'var(--status-warning)', 'C. Adams', 'Engaged', 'AWV', 'Medium', '7', 3, 3, 'en'),
  ('jsa-13', 'M-JSA-1013', 'Charles Jackson', 'CJ', 'M', '72y 9m', 1, 2, '08/12/2026', 'Due in 2D', 'var(--status-warning)', 'E. Clarke', 'Open', 'APE', 'Medium', '8', 4, 3, 'en'),
  ('jsa-14', 'M-JSA-1014', 'Joseph Lee', 'JL', 'M', '60y 5m', 3, 0, '05/05/2026', 'Unable to Reach', 'var(--status-success)', 'F. Davies', 'Unable to Reach', 'APE', 'Low', '6', 2, 2, 'en'),
  ('jsa-15', 'M-JSA-1015', 'Margaret Perez', 'MP', 'F', '67y 1m', 4, 3, '09/20/2026', 'Due in 40D', 'var(--neutral-200)', 'J. Hughes', 'Attempted', 'AWV', 'High', '9', 5, 4, 'en'),
  ('jsa-16', 'M-JSA-1016', 'Thomas Thompson', 'TT', 'M', '59y 11m', 0, 0, '11/05/2026', 'Due in 80D', 'var(--neutral-200)', NULL, 'New', 'AWV', 'Low', '3', 1, 1, 'en'),
  ('jsa-17', 'M-JSA-1017', 'Sarah White', 'SW', 'F', '66y 3m', 3, 1, '08/11/2026', 'Due Today', 'var(--status-warning)', 'E. Clarke', 'Engaged - Requires Follow Up', 'AWV', 'High', '9', 5, 4, 'en'),
  ('jsa-18', 'M-JSA-1018', 'Christopher Hall', 'CH', 'M', '79y 2m', 7, 4, '07/25/2026', 'Overdue: 2w', 'var(--status-error)', 'D. Baker', 'Open', 'AWV', 'High', '10', 7, 5, 'en'),
  ('jsa-19', 'M-JSA-1019', 'Karen Allen', 'KA', 'F', '73y 6m', 1, 2, '09/10/2026', 'Due in 30D', 'var(--neutral-200)', 'G. Evans', 'Engaged', 'AWV', 'High', '9', 6, 4, 'en'),
  ('jsa-20', 'M-JSA-1020', 'Daniel Young', 'DY', 'M', '68y 11m', 2, 2, '08/16/2026', 'Due in 6D', 'var(--status-info)', 'H. Foster', 'Open', 'APE', 'Medium', '7', 3, 3, 'en'),
  ('jsa-21', 'M-JSA-1021', 'Nancy King', 'NK', 'F', '62y 9m', 0, 1, '10/15/2026', 'Due in 60D', 'var(--neutral-200)', 'C. Adams', 'New', 'AWV', 'Medium', '8', 4, 3, 'en'),
  ('jsa-22', 'M-JSA-1022', 'Paul Wright', 'PL', 'M', '67y 3m', 2, 1, '08/30/2026', 'Due in 20D', 'var(--status-warning)', 'J. Hughes', 'Engaged', 'APE', 'High', '9', 5, 4, 'en'),
  ('jsa-23', 'M-JSA-1023', 'Lisa Scott', 'LS', 'F', '64y 8m', 3, 0, '09/01/2026', 'Due in 22D', 'var(--neutral-200)', 'E. Clarke', 'Attempted', 'APE', 'Medium', '6', 2, 2, 'en'),
  ('jsa-24', 'M-JSA-1024', 'Mark Green', 'MG', 'M', '70y 4m', 4, 2, '08/13/2026', 'Due in 3D', 'var(--status-warning)', 'D. Baker', 'Open', 'APE', 'Medium', '7', 3, 2, 'en'),
  ('jsa-25', 'M-JSA-1025', 'Donna Baker', 'DB', 'F', '75y 7m', 3, 0, '04/20/2026', 'Unable to Reach', 'var(--status-success)', 'G. Evans', 'Unable to Reach', 'APE', 'Medium', '8', 4, 3, 'en')
ON CONFLICT (id) DO NOTHING;
