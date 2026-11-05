BEGIN;

-- Drop the hcc_members_v2 compatibility view.
--
-- History: when hcc_members was normalized (DOS list → hcc_member_visits,
-- doc status → hcc_member_documents), this view was added so the app could
-- keep reading the old fat-row shape. Because it looked like a table, write
-- paths started targeting it and failed on its derived columns
-- ("cannot insert into column dos_list of view"), which is how spawned
-- worklist rows silently vanished on reload.
--
-- The app no longer reads it: fetchHccMembers now reads hcc_members plus
-- the child tables directly and rebuilds the row shape in JS, and all
-- writes target base/child tables.
--
-- Safe to run any time after the store change ships. If any consumer were
-- missed, this fails loudly rather than leaving a second source of truth.
--
-- ORDER MATTERS: worklist_badge_counts depends on hcc_members_v2, so the
-- dependent badge view is dropped FIRST, dropping hcc_members_v2 first
-- fails with 2BP01 (dependent objects).

-- ── 1) Drop the dependent badge view ───────────────────────────────────────
-- worklist_badge_counts (SubNav badge integers) selected from
-- hcc_members_v2. Its only use of the view was `id, member_id` for key
-- normalization, both exist on the base table, so repoint it there and
-- recreate below. Same definition otherwise (security_invoker preserved so
-- RLS on underlying tables still applies).
DROP VIEW IF EXISTS public.worklist_badge_counts;

-- ── 2) Now the compatibility view itself ───────────────────────────────────
DROP VIEW IF EXISTS public.hcc_members_v2;

-- ── 3) Recreate worklist_badge_counts against the base table ──────────────

CREATE VIEW public.worklist_badge_counts
WITH (security_invoker = true) AS
WITH keys AS (
  SELECT 'hcc'::text AS src,
         lower(trim(both from regexp_replace(coalesce(member_id, id::text), '^#', ''))) AS k
    FROM public.hcc_members
  UNION ALL
  SELECT 'awv',
         lower(trim(both from regexp_replace(coalesce(member_id, id::text), '^#', '')))
    FROM public.awv_members
  UNION ALL
  SELECT 'ccm',
         lower(trim(both from regexp_replace(coalesce(member_id, id::text), '^#', '')))
    FROM public.ccm_worklist_members
  UNION ALL
  SELECT 'snp',
         lower(trim(both from regexp_replace(coalesce(member_id, id::text), '^#', '')))
    FROM public.snp_worklist_members
  UNION ALL
  SELECT 'jsa',
         lower(trim(both from regexp_replace(coalesce(member_id, id::text), '^#', '')))
    FROM public.jsa_members
  UNION ALL
  SELECT 'tcm',
         lower(trim(both from regexp_replace(coalesce(member_id, id::text), '^#', '')))
    FROM public.patients
)
SELECT
  (SELECT count(DISTINCT k) FROM keys WHERE src = 'hcc' AND k <> '') AS hcc_unique,
  (SELECT count(*) FROM public.awv_members)                          AS awv,
  (SELECT count(*) FROM public.ccm_worklist_members)                 AS ccm,
  (SELECT count(*) FROM public.snp_worklist_members)                 AS snp,
  (SELECT count(*) FROM public.jsa_members)                          AS jsa,
  (SELECT count(*) FROM public.patients)                             AS tcm,
  (SELECT count(*) FROM public.patients
    WHERE agent_assigned IS NOT NULL AND agent_assigned <> '')       AS toc_ip,
  (SELECT count(DISTINCT k) FROM keys WHERE k <> '')                 AS all_patients;

GRANT SELECT ON public.worklist_badge_counts TO authenticated;
GRANT SELECT ON public.worklist_badge_counts TO service_role;
COMMIT;
