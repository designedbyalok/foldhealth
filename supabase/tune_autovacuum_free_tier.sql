-- Free-tier Disk IO relief: make autovacuum actually run on the tiny hot tables.
--
-- WHAT THE DASHBOARD IS ALARMING ABOUT
-- The project is on Supabase's free compute add-on, which has a small Disk IO
-- budget (baseline ≈ 87 IOPS; anything past that consumes a burst budget that
-- refills slowly). Yesterday's warning email says we're depleting that budget.
--
-- WHY (measured, not guessed)
-- The database is 29 MB. Cache hit rate is 100% on every hot table. Reads are
-- not the driver of the IO budget; writes are. The dominant write pattern is a
-- classic small-table anti-pattern:
--
--   Table                        live  dead  dead_pct  last_autovacuum
--   ccm_billing_periods             4    45    1125%   never
--   user_worklist_prefs             4    21     525%   never
--   ccm_billing_reports             3    12     400%   never
--   notifications                  11    37     336%   never
--   ccm_worklist_members            9    29     322%   never
--   embed_domains                   8    23     287%   never
--   hedis_members                  15    41     273%   never
--   forms                          14    38     271%   never   (analyze ran once in May)
--   campaigns                      19    38     200%   never
--   analytics_time_series           6    12     200%   never
--   letters                        10    20     200%   never
--   program_documents               3     6     200%   never
--   embed_components                8    14     175%   never
--   caregap_activity               12    21     175%   never
--   form_responses                  6    10     167%   never
--
-- Postgres's default autovacuum trigger is
--   autovacuum_vacuum_threshold (50) + autovacuum_vacuum_scale_factor (0.20) * n_live_tup
-- Against a 4-row table that resolves to 50.8 dead tuples before autovacuum
-- fires. By the time it fires, the table has been rewritten 10-15× and every
-- UPDATE has been writing dead-tuple churn to disk (heap + indexes + WAL) with
-- no compaction in between. On these row counts the *ratio* of dead-to-live
-- looks alarming, but the absolute bytes are still small, the drain is not
-- storage, it is IO per write.
--
-- Larger high-churn tables (patients, hcc_members, all_patients) are being
-- autovacuumed fine, their dead-tuple counts stay near zero, so they are
-- left at the defaults.
--
-- WHAT THIS DOES
--   1. Per-table autovacuum tuning: threshold 10, scale-factor 0 for VACUUM;
--      threshold 20, scale-factor 0.05 for ANALYZE. With these settings a
--      table with 4 live rows fires autovacuum after 10 dead tuples instead of
--      50, and analyze fires after 20 changes instead of a percentage that
--      cannot be met.
--   2. A one-time VACUUM (ANALYZE) on each of those tables, run outside the
--      transaction because VACUUM cannot run inside one. This resets the bloat
--      that has already accumulated so the new thresholds start from a clean
--      baseline.
--
-- WHY THIS IS SAFE ON FREE TIER
--   • autovacuum runs at background priority and yields to foreground writes.
--     Making it fire more often on a table with 20-page churn does not add
--     meaningful load: it removes the deferred cost.
--   • These are per-table settings via ALTER TABLE ... SET; nothing global
--     changes. Rollback is one line per table.
--   • No compute or plan change is required. No config.toml push either, the
--     memory note on that stands.
--
-- WHAT THIS DOES NOT DO
-- The single largest dirtied-block source we control is the email-builder save
-- (campaigns UPDATE color_variables/email_template: 16,709 dirtied blocks over
-- 278 calls, ≈ 60 blocks per save). That is intrinsic to rewriting a TOASTed
-- JSONB blob on save and is a legitimate user-initiated write, not worth
-- chasing at the SQL layer. If the free-tier budget stays tight after this
-- change, the next lever is client-side: dedupe/batch email-builder saves so a
-- user cannot fire back-to-back saves within a few seconds.
--
-- Auth infrastructure (auth.refresh_tokens, auth.sessions) is also
-- write-heavy (15,562 combined dirtied blocks) but is managed by Supabase's
-- auth service; we do not tune it here.

begin;

do $$
declare
  tbl text;
  tables text[] := array[
    'ccm_billing_periods',
    'user_worklist_prefs',
    'ccm_billing_reports',
    'notifications',
    'ccm_worklist_members',
    'embed_domains',
    'hedis_members',
    'forms',
    'campaigns',
    'analytics_time_series',
    'letters',
    'program_documents',
    'embed_components',
    'caregap_activity',
    'form_responses',
    'tasks',
    'agent_flows'
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

-- ── Reset the bloat that already accumulated ────────────────────────────────
-- Postgres refuses to run VACUUM inside a transaction block, so these run as
-- top-level statements below the COMMIT. Regular VACUUM (not FULL) does not
-- take an exclusive lock: it runs concurrently with reads and writes.

vacuum (analyze) public.ccm_billing_periods;
vacuum (analyze) public.user_worklist_prefs;
vacuum (analyze) public.ccm_billing_reports;
vacuum (analyze) public.notifications;
vacuum (analyze) public.ccm_worklist_members;
vacuum (analyze) public.embed_domains;
vacuum (analyze) public.hedis_members;
vacuum (analyze) public.forms;
vacuum (analyze) public.campaigns;
vacuum (analyze) public.analytics_time_series;
vacuum (analyze) public.letters;
vacuum (analyze) public.program_documents;
vacuum (analyze) public.embed_components;
vacuum (analyze) public.caregap_activity;
vacuum (analyze) public.form_responses;
vacuum (analyze) public.tasks;
vacuum (analyze) public.agent_flows;

-- ── Verify ──────────────────────────────────────────────────────────────────
-- Autovacuum settings are attached:
--   select relname, reloptions from pg_class
--    where relnamespace='public'::regnamespace
--      and reloptions is not null
--    order by relname;
--   Expect: 17 rows with the four autovacuum_* keys.
--
-- Bloat is reset:
--   select relname, n_live_tup, n_dead_tup, last_vacuum, last_analyze
--     from pg_stat_all_tables
--    where schemaname='public'
--      and relname = any(array['ccm_billing_periods','campaigns','forms','tasks','agent_flows'])
--    order by relname;
--   Expect: n_dead_tup = 0 (or near it) and last_vacuum ≈ now().
--
-- Monitor going forward: the same query in a week should show n_dead_tup
-- staying below 20 on these tables, that is the sign the tuning is working.
--
-- Dashboard: watch Reports → Database → Disk IO for the next 24-48 hours. If
-- consumption drops back below the burst-refill line, the change is enough.
-- If not, revisit with the client-side write-batching work called out above.
--
-- ── Rollback ────────────────────────────────────────────────────────────────
--   alter table public.ccm_billing_periods reset (autovacuum_vacuum_threshold,
--     autovacuum_vacuum_scale_factor, autovacuum_analyze_threshold,
--     autovacuum_analyze_scale_factor);
--   (repeat for every table listed above)
