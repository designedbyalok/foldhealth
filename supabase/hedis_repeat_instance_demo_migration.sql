-- HEDIS demo: a gap that closed from data and was then added again manually.
--
-- Two members get the pair the worklist and Care Gap Details show as
-- instances of one gap:
--   Thomas Brooks (ph-19408) CBP, Barbara Klein (ph-19405) BCS
--   Instance 1: the Astrana gap, now "Closed - Data" (supersededAt set)
--   Instance 2: a new manual instance (source fold-native, Open), with the
--               workflow and reason Add Care Gaps saves
-- The new instance goes first, the way Add Care Gaps inserts it. Idempotent:
-- a member whose gap already has a manual instance is skipped.
--
-- Ask Alok Kumar to run this on Supabase.

begin;

update public.hedis_members m
set gaps = jsonb_build_array(jsonb_build_object(
      'code', d.code,
      'status', 'Open',
      'startDate', '10/20/2026',
      'assignee', m.assignee,
      'source', 'fold-native',
      'whitelistId', d.code || '-MY2026',
      'measureYear', 2026,
      'ipa', m.ipa,
      'hpCode', m.hp_code,
      'workflows', d.workflows,
      'reason', d.reason
    ))
    || (
      select jsonb_agg(
        case when g->>'code' = d.code and g->>'supersededAt' is null
          then g || jsonb_build_object('status', 'Closed - Data', 'closedDate', '10/10/2026', 'supersededAt', '10/20/2026')
          else g end
        order by ord)
      from jsonb_array_elements(m.gaps) with ordinality as e(g, ord)
    )
from (values
  ('ph-19408', 'CBP', '["Outreach"]'::jsonb, 'Missing evidence'),
  ('ph-19405', 'BCS', '["Clinical Note"]'::jsonb, 'Closed incorrectly')
) as d(member_id, code, workflows, reason)
where m.id = d.member_id
  and m.gaps @> jsonb_build_array(jsonb_build_object('code', d.code))
  and not m.gaps @> jsonb_build_array(jsonb_build_object('code', d.code, 'source', 'fold-native'));

commit;
