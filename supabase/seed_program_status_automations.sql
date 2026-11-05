-- GBI auto-status, built from Settings > Automations nodes:
--   A patient's care program status changes (trigger: programStatuses, programCodes)
--   → Update care plan item statuses (action: toStatus, reason, kinds)
-- Account defaults have no program codes. An automation for specific program
-- types overrides the default for those programs. Re-runnable: fixed ids,
-- upserted. The SNP override is a draft example; activate it to take effect.

WITH rules (id, name, description, status, on_status, program_codes, to_status, reason) AS (VALUES
  ('96a402f9-7a7a-5f15-a52f-50c095f72b29'::uuid,
   'Program UTR → open care plan items UTR',
   'When a program moves to Unable to Reach, every open goal, intervention and barrier in its care plan moves to UTR.',
   'active', 'utr', '[]'::jsonb, 'UTR', 'Program UTR'),
  ('9f63da48-753b-581f-860e-0d51104db03c'::uuid,
   'Program paused → open care plan items On Hold',
   'When a program is paused, its open care plan items go On Hold.',
   'active', 'paused', '[]'::jsonb, 'On Hold', 'Program paused'),
  ('28698c54-bdfd-50ed-b03f-03ba89511a99'::uuid,
   'Program completed → open care plan items Discontinued',
   'When a program is completed, care plan items still open are discontinued. Met and Not Met outcomes are kept.',
   'active', 'completed', '[]'::jsonb, 'Discontinued', 'Program completed'),
  ('d0166f3b-4055-5348-8ef5-d5537d84a66c'::uuid,
   'Program closed → open care plan items Discontinued',
   'When a program is closed (discontinued), care plan items still open are discontinued. Met and Not Met outcomes are kept.',
   'active', 'closed', '[]'::jsonb, 'Discontinued', 'Program closed'),
  ('1d2c5cc0-5f63-5f00-9aed-1263c5e08deb'::uuid,
   'SNP override: Program UTR → open care plan items On Hold',
   'Example override for SNP: outreach continues while the member is unreachable, so open items go On Hold instead of UTR.',
   'draft', 'utr', '["SNP"]'::jsonb, 'On Hold', 'Program UTR')
)
INSERT INTO automations (id, name, description, status, schedule, graph, created_by, updated_by)
SELECT r.id, r.name, r.description, r.status, 'onTrigger',
  jsonb_build_object('nodes', jsonb_build_array(
    jsonb_build_object('id', 'trigger', 'type', 'careProgramStatusChanged', 'parentId', null, 'branch', null, 'order', 0,
      'config', jsonb_build_object('programStatuses', jsonb_build_array(r.on_status), 'programCodes', r.program_codes)),
    jsonb_build_object('id', 'set-status', 'type', 'setGbiStatus', 'parentId', 'trigger', 'branch', 'next', 'order', 0,
      'config', jsonb_build_object('toStatus', r.to_status, 'reason', r.reason,
        'kinds', '["goal", "intervention", "barrier"]'::jsonb))
  )),
  'Fold Health', 'Fold Health'
FROM rules r
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name, description = EXCLUDED.description, status = EXCLUDED.status,
      graph = EXCLUDED.graph, updated_by = EXCLUDED.updated_by, updated_at = now();
