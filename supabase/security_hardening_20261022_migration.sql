-- Security hardening from the 2026-10-22 audit. Safe to re-run.
--
-- 1. patient_vitals was created with a policy open to the anon role (anyone
--    holding the public key could read and write vitals). Signed-in staff only.
DROP POLICY IF EXISTS "Allow all on patient_vitals" ON public.patient_vitals;
CREATE POLICY "Allow all on patient_vitals" ON public.patient_vitals
  FOR ALL TO authenticated
  USING ((select auth.uid()) is not null) WITH CHECK ((select auth.uid()) is not null);

-- 2. scripts/seed.js used to recreate these policies with no role, so every
--    `bun run seed` reopened them to anon. The seed is fixed; this narrows any
--    database it already ran against.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT * FROM (VALUES
      ('patient_problems',        'Allow all on patient_problems',        'ALL'),
      ('patient_allergies',       'Allow all on patient_allergies',       'ALL'),
      ('patient_social_history',  'Allow all on patient_social_history',  'ALL'),
      ('patient_history_entries', 'Allow all on patient_history_entries', 'ALL'),
      ('patient_immunizations',   'Allow all on patient_immunizations',   'ALL'),
      ('ccm_billing_periods',     'Allow all for ccm_billing_periods',     'ALL'),
      ('ccm_billable_activities', 'Allow all for ccm_billable_activities', 'ALL'),
      ('ccm_worklist_members',    'Allow all for ccm_worklist_members',    'ALL'),
      ('snp_worklist_members',    'Allow all for snp_worklist_members',    'ALL'),
      ('caregap_activity',        'Allow all for caregap_activity',        'ALL'),
      ('ccm_billing_reports',     'Allow all for ccm_billing_reports',     'ALL'),
      ('practice_locations',      'Allow all for practice_locations',      'ALL'),
      ('icd_codes',               'Read icd_codes',                        'SELECT'),
      ('pos_codes',               'Read pos_codes',                        'SELECT')
    ) AS v(tbl, pol, cmd)
  LOOP
    IF to_regclass('public.' || t.tbl) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t.pol, t.tbl);
      IF t.cmd = 'SELECT' THEN
        EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', t.pol, t.tbl);
      ELSE
        EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t.pol, t.tbl);
      END IF;
    END IF;
  END LOOP;
END $$;

-- 3. A one-off backup of staff emails and admin roles, left without RLS
--    (readable with the public key). It has served its purpose.
DROP TABLE IF EXISTS public.profiles_admin_role_backup_20260810;
