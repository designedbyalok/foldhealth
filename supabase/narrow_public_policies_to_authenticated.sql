-- Narrow every wide-open PUBLIC policy to authenticated.
--
-- 68 policies across 59 tables currently grant USING (true) /
-- WITH CHECK (true) to PUBLIC. In Postgres PUBLIC means EVERY role, including
-- `anon`, whose key ships in the browser bundle. Demonstrated with that key:
-- all_patients and hcc_members return patient names, member ids, gender, age
-- and emails. RLS is enabled on these tables but gates nothing.
--
-- THIS IS A ROLE SWAP, NOT A REMOVAL. 62 tables have the PUBLIC policy as their
-- ONLY policy; dropping it would leave RLS enabled with zero policies, which
-- denies everything and takes the app down. ALTER POLICY ... TO authenticated
-- keeps each USING / WITH CHECK expression byte-identical and only removes
-- `anon` from the role list.
--
-- Effect, verified before writing:
--   • authenticated: no change. The same policy, the same expression, still
--     applies. This is a Postgres guarantee, not an expectation.
--   • service_role: no change. rolbypassrls = true, so seed scripts, the
--     api/ functions (api/_lib/icd.js uses the service key) and the
--     delete-user edge function never consult policies at all.
--   • anon: loses access. That is the entire point.
--
-- Deliberately EXCLUDED, do not add to this file:
--   forms, form_responses, App.jsx renders PublicFormView for #/f/{id}
--   WITHOUT auth, so a patient filling a shared form is genuinely anonymous.
--   Narrowing those two breaks patient form-filling.
--
-- Also checked: featurebase-jwt is the only edge function using the anon key,
-- and it forwards the caller's Authorization header (so it acts as that user)
-- and reads no tables: only auth.getUser().
--
-- Known, intended consequence: the localhost-only "Continue without login"
-- dev bypass will show empty data everywhere, because those sessions are
-- genuinely anonymous (App.jsx:40). Log in to see data.
--
-- Single transaction on purpose: a half-applied security posture is worse
-- than either end state. Grouped by feature area so a targeted rollback is
-- easy to carve out.
--
-- Generated from pg_policies; regenerate rather than hand-editing if the
-- policy set drifts.

begin;

-- ── analytics: 10 policies / 5 tables ─────────────────────────────────────
alter policy "analytics_configs_read" on public.analytics_configs to authenticated;
alter policy "analytics_configs_write" on public.analytics_configs to authenticated;
alter policy "analytics_kpis_read" on public.analytics_kpis to authenticated;
alter policy "analytics_kpis_write" on public.analytics_kpis to authenticated;
alter policy "analytics_bars_read" on public.analytics_progress_bars to authenticated;
alter policy "analytics_bars_write" on public.analytics_progress_bars to authenticated;
alter policy "analytics_tables_read" on public.analytics_tables to authenticated;
alter policy "analytics_tables_write" on public.analytics_tables to authenticated;
alter policy "analytics_ts_read" on public.analytics_time_series to authenticated;
alter policy "analytics_ts_write" on public.analytics_time_series to authenticated;

-- ── calls / comms: 6 policies / 6 tables ─────────────────────────────────
alter policy "Allow all for anon" on public.call_details to authenticated;
alter policy "Allow all access to campaigns" on public.campaigns to authenticated;
alter policy "Allow all for anon" on public.chat_groups to authenticated;
alter policy "Allow all for anon" on public.chat_participants to authenticated;
alter policy "Allow all for anon" on public.sticky_note_history to authenticated;
alter policy "Allow all for anon" on public.sticky_notes to authenticated;

-- ── care programs: 5 policies / 5 tables ─────────────────────────────────
alter policy "Allow all for ccm_billable_activities" on public.ccm_billable_activities to authenticated;
alter policy "Allow all for ccm_billing_periods" on public.ccm_billing_periods to authenticated;
alter policy "Allow all for ccm_billing_reports" on public.ccm_billing_reports to authenticated;
alter policy "Allow all for anon" on public.goals to authenticated;
alter policy "Allow all letters" on public.letters to authenticated;

-- ── hcc: 20 policies / 18 tables ───────────────────────────────────────────
alter policy "Allow all for caregap_activity" on public.caregap_activity to authenticated;
alter policy "Allow all for hcc_added_charts" on public.hcc_added_charts to authenticated;
alter policy "Allow all for hcc_chart_status" on public.hcc_chart_status to authenticated;
alter policy "Allow all for hcc_diag_comments" on public.hcc_diag_comments to authenticated;
alter policy "Allow all for hcc_diag_documents" on public.hcc_diag_documents to authenticated;
alter policy "Allow all for hcc_diag_history" on public.hcc_diag_history to authenticated;
alter policy "Allow all for hcc_diag_notes" on public.hcc_diag_notes to authenticated;
alter policy "Allow all for hcc_diagnosis_gaps" on public.hcc_diagnosis_gaps to authenticated;
alter policy "Enable read access for all users" on public.hcc_diagnosis_gaps to authenticated;
alter policy "Allow all for hcc_documents" on public.hcc_documents to authenticated;
alter policy "Allow all for hcc_gap_activity" on public.hcc_gap_activity to authenticated;
alter policy "Allow all for hcc_gap_confidence" on public.hcc_gap_confidence to authenticated;
alter policy "Allow all for hcc_gap_dos_actions" on public.hcc_gap_dos_actions to authenticated;
alter policy "Allow all for hcc_gap_sweep" on public.hcc_gap_sweep to authenticated;
alter policy "Enable read access for all users" on public.hcc_member_documents to authenticated;
alter policy "Allow all for hcc_member_raf" on public.hcc_member_raf to authenticated;
alter policy "Enable read access for all users" on public.hcc_member_visits to authenticated;
alter policy "Allow all for hcc_members" on public.hcc_members to authenticated;
alter policy "Enable read access for all users" on public.hcc_members to authenticated;
alter policy "Allow all for hcc_removed_charts" on public.hcc_removed_charts to authenticated;

-- ── other: 1 policies / 1 tables ─────────────────────────────────────────
alter policy "Allow all for anon" on public.appointments to authenticated;

-- ── patient / clinical: 15 policies / 13 tables ────────────────────────────
alter policy "all_patients_read" on public.all_patients to authenticated;
alter policy "all_patients_write" on public.all_patients to authenticated;
alter policy "Allow all" on public.apcm_patients to authenticated;
alter policy "Allow all" on public.awv_members to authenticated;
alter policy "Allow all for care_teams" on public.care_teams to authenticated;
alter policy "Allow all for ccm_worklist_members" on public.ccm_worklist_members to authenticated;
alter policy "Allow all" on public.hedis_members to authenticated;
alter policy "Allow all for anon" on public.p360_profiles to authenticated;
alter policy "Allow all for patient_care_programs" on public.patient_care_programs to authenticated;
alter policy "Allow all" on public.patient_registry to authenticated;
alter policy "Allow all access" on public.patients to authenticated;
alter policy "population_groups_read" on public.population_groups to authenticated;
alter policy "population_groups_write" on public.population_groups to authenticated;
alter policy "Allow all for practice_locations" on public.practice_locations to authenticated;
alter policy "Allow all for snp_worklist_members" on public.snp_worklist_members to authenticated;

-- ── platform / config: 8 policies / 8 tables ─────────────────────────────
alter policy "Allow all access on agent_config" on public.agent_config to authenticated;
alter policy "Allow all for anon" on public.agent_flows to authenticated;
alter policy "Allow all for anon" on public.agent_rules to authenticated;
alter policy "Allow all access on agents" on public.agents to authenticated;
alter policy "Allow all for audit_logs" on public.audit_logs to authenticated;
alter policy "Allow all for embed_components" on public.embed_components to authenticated;
alter policy "Allow all for embed_domains" on public.embed_domains to authenticated;
alter policy "Allow all" on public.user_worklist_prefs to authenticated;

-- ── tasks: 3 policies / 3 tables ─────────────────────────────────────────
alter policy "Allow all for task_audit_log" on public.task_audit_log to authenticated;
alter policy "Allow all for task_pools" on public.task_pools to authenticated;
alter policy "Allow all for tasks" on public.tasks to authenticated;

commit;

-- ── Verify ────────────────────────────────────────────────────────────────
-- select count(*) from pg_policies where schemaname='public'
--   and roles::text='{public}' and (qual='true' or with_check='true');
-- Expected: 2, the two form tables above.
--
-- No table may be left without a policy:
-- select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
--  where n.nspname='public' and c.relkind='r' and c.relrowsecurity
--    and not exists (select 1 from pg_policies p where p.tablename=c.relname);
--
-- With the ANON key, PHI must now be empty and forms must still work:
--   /rest/v1/all_patients?select=name&limit=1   -> []
--   /rest/v1/hcc_members?select=name&limit=1    -> []
--   /rest/v1/forms?select=id&limit=1            -> rows
--
-- ── Rollback ──────────────────────────────────────────────────────────────
-- Re-run the same statements with `to public` instead of `to authenticated`,
-- or just the block for one feature area.
