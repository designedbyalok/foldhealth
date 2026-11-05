-- Pharmacy (Med Adherence) care team for the pharmacy worklist's
-- Auto-assign: coordinators routed by IPA ownership first, then health plan.
-- Each rule's pct is that coordinator's share; a coordinator's rules add up
-- to no more than their capacity. Edit the team in Settings > Care Teams.
--
-- Same team as SAMPLE_CARE_PROGRAM_TEAMS ('seed-pharm') in
-- src/features/settings/billing/careProgramBillingData.js. The coordinators
-- match the pharmacy demo assignees; auto-assignment links them to platform
-- users by name. Safe to run more than once.

begin;

insert into public.care_teams (id, name, kind, team_type, allocated_tins, created_label, created_by, modified_label, modified_by, members)
values (
  'seed-pharm', 'Pharmacy Adherence Team', 'care-program', 'PHARM', '[]'::jsonb,
  '10/26/2026', 'Richard Willson', '10/26/2026', 'Richard Willson',
  '[
    {"userId": "pharm-priya", "name": "Priya Natarajan", "initials": "PN", "roles": "Care Manager", "capacityPct": 100, "canLogTime": true,
     "assignTo": [{"dim": "IPA", "value": "Astrana IPA", "pct": 60}, {"dim": "Health Plan", "value": "SCAN Classic", "pct": 20}, {"dim": "Health Plan", "value": "Humana Gold Plus", "pct": 20}]},
    {"userId": "pharm-marcus", "name": "Marcus Reyes", "initials": "MR", "roles": "Care Manager", "capacityPct": 100, "canLogTime": true,
     "assignTo": [{"dim": "IPA", "value": "Prospect Medical Group", "pct": 60}, {"dim": "Health Plan", "value": "Aetna Medicare Advantage", "pct": 20}, {"dim": "Health Plan", "value": "Blue Shield Medicare", "pct": 20}]}
  ]'::jsonb
)
on conflict (id) do nothing;

commit;
