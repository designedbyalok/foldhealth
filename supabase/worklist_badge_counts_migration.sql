-- One-row view of SubNav badge integers. Replaces six id-only REST queries
-- (hcc / awv / ccm / snp / jsa / patients) with a single select.
--
-- Two of those badges are not row counts: HCC is DISTINCT member_id (a
-- patient can have several coding records), and All Patients is the union
-- of normalized member ids across every slice. Both have to happen in SQL
-- or we would still be shipping the id columns to the client.
--
-- SECURITY INVOKER so RLS on the underlying tables still applies, a
-- security-definer view would leak every tenant's roster to any
-- authenticated session.
--
-- HEDIS is not in this view: the SubNav badge reads a local mock constant
-- (no network). The client adds HEDIS keys into all_patients after fetch.

DROP VIEW IF EXISTS public.worklist_badge_counts;

CREATE VIEW public.worklist_badge_counts
WITH (security_invoker = true) AS
WITH keys AS (
  SELECT 'hcc'::text AS src,
         lower(trim(both from regexp_replace(coalesce(member_id, id::text), '^#', ''))) AS k
    FROM public.hcc_members_v2
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
