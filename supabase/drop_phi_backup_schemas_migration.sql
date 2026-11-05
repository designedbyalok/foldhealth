-- Drop the backup schemas the identity-merge and cleanup migrations left behind.
--
-- Each holds a full copy of patient rows with no row level security. They are
-- not reachable through the API today (only `public` is exposed), but adding
-- any of them to the exposed schemas would publish the PHI, and they keep
-- copies of data that has since been corrected or removed.
--
-- Source migrations:
--   annette_bak    annette_brave_identity_merge_migration.sql
--   awvjsa_bak     awv_jsa_identity_merge_migration.sql
--   dupmerge_bak   duplicate_name_identity_merge_migration.sql
--   demo_bak       unify_patient_demographics_migration.sql
--   care_plan_bak  care_plan_goal_units_cleanup_migration.sql
--   reident_bak    patient_reident_member_id_migration.sql
--   worklist_bak   worklist_seed_dupes_cleanup / worklist_dedupe_synthetic_ids migrations
--
-- NOT REVERSIBLE. Run only once nobody needs to roll those migrations back.
-- Check what is there first:
--   select nspname, count(c.oid) as tables
--     from pg_namespace n left join pg_class c on c.relnamespace = n.oid and c.relkind = 'r'
--    where nspname like '%\_bak' group by nspname;

begin;

drop schema if exists annette_bak cascade;
drop schema if exists awvjsa_bak cascade;
drop schema if exists dupmerge_bak cascade;
drop schema if exists demo_bak cascade;
drop schema if exists care_plan_bak cascade;
drop schema if exists reident_bak cascade;
drop schema if exists worklist_bak cascade;

commit;
