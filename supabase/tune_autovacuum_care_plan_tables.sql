-- Free-tier Disk IO relief, round two: care-plan tables.
--
-- The Aug 21 tuning (supabase/tune_autovacuum_free_tier.sql) fixed 17 tiny
-- hot tables. That set is holding, every one of them still carries the
-- reloptions today and dead_pct is well under 30%.
--
-- What changed since then:
--   * The Sep 10 FK fix (fix_barrier_goals_fk_target.sql) made the barrier
--     join table start accepting writes for the first time. Combined with the
--     care-plan editor's delete-and-reinsert pattern (savePatientCarePlanBarrier)
--     it went from 0 writes to 11,599 in 24 days on 166 live rows.
--   * Several care-plan tables shipped or grew after Aug 21 and were never
--     tuned. They now show the same pattern the original 17 did: tiny table,
--     high churn, autovacuum thresholds tuned for a 1000-row table never fire.
--
-- Measured (2026-09-15, 176-day pg_stat_statements window):
--   Table                                 live  dead  dead_pct  last_av
--   patient_care_plan_versions               3    15   500.0%   never
--   care_plan_templates                     53    57   107.5%   never
--   population_groups                       30    28    93.3%   never
--   patient_care_plan_barriers             126    72    57.1%   Sep 14
--   patient_care_plan_barrier_goals        166    74    44.6%   Sep 14
--
-- The last two are already firing autovacuum, but only marginally, the
-- write rate outpaces the default threshold and dead_pct grows between
-- runs. Tightening the thresholds keeps them under 20%.
--
-- clinical_notes (13 live / 41 dead / 315%) is deliberately EXCLUDED. It is
-- an append-mostly table where dead tuples come from the versioning workflow
-- (write new version, mark old, retention), not from write amplification.
-- Autovacuum will catch up naturally on next churn cycle.
--
-- ── Also shipped this session, not in this file ────────────────────────────
-- savePatientCarePlanBarrier in useAppStore.js was rewritten to do diff-based
-- join sync instead of wipe-and-reinsert. Bulk status/priority changes now
-- issue zero writes to patient_care_plan_barrier_goals when goals are
-- unchanged, which is the common case. That is the primary IO relief; this
-- migration is the safety net so the tables that DO churn get compacted
-- promptly.

begin;

do $$
declare
  tbl text;
  tables text[] := array[
    'patient_care_plan_barrier_goals',
    'patient_care_plan_barriers',
    'patient_care_plan_versions',
    'patient_care_plan_interventions',
    'care_plan_audit',
    'care_plan_templates',
    'population_groups'
  ];
begin
  foreach tbl in array tables loop
    execute format($f$
      alter table public.%I set (
        autovacuum_vacuum_threshold  = 10,
        autovacuum_vacuum_scale_factor = 0.0,
        autovacuum_analyze_threshold = 20,
        autovacuum_analyze_scale_factor = 0.05
      )
    $f$, tbl);
  end loop;
end $$;

commit;

-- Reset the accumulated bloat now. Regular VACUUM (not FULL): concurrent
-- with reads and writes, no exclusive lock. Cannot run inside a transaction,
-- so these follow the COMMIT above as top-level statements.

vacuum (analyze) public.patient_care_plan_barrier_goals;
vacuum (analyze) public.patient_care_plan_barriers;
vacuum (analyze) public.patient_care_plan_versions;
vacuum (analyze) public.patient_care_plan_interventions;
vacuum (analyze) public.care_plan_audit;
vacuum (analyze) public.care_plan_templates;
vacuum (analyze) public.population_groups;

-- Verify
--   select relname, reloptions from pg_class
--    where relnamespace='public'::regnamespace and reloptions is not null
--    order by relname;
--   Expect: 24 tables total (17 from Aug 21 plus the 7 above).
--
--   select relname, n_live_tup, n_dead_tup, last_vacuum
--     from pg_stat_all_tables
--    where schemaname='public'
--      and relname = any(array['patient_care_plan_barrier_goals',
--                              'patient_care_plan_barriers',
--                              'patient_care_plan_versions',
--                              'care_plan_templates',
--                              'population_groups'])
--    order by relname;
--   Expect: n_dead_tup = 0, last_vacuum ≈ now().
--
-- Dashboard: watch Reports → Database → Disk IO over the next 24-48 hours.
-- Between this and the app-side diff-based join sync, the free-tier budget
-- should stop depleting. If it does not, the next levers are the tasks
-- (8332 upd / 67 rows) and profiles (7391 upd / 67 rows) write storms,
-- both need product-level triage, not schema tuning.
--
-- Rollback
--   alter table public.patient_care_plan_barrier_goals reset (autovacuum_vacuum_threshold,
--     autovacuum_vacuum_scale_factor, autovacuum_analyze_threshold, autovacuum_analyze_scale_factor);
--   (repeat for every table listed above)
