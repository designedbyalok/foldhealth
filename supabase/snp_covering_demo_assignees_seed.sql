-- Demo: give a few unassigned SNP members to Navin Jethwani and Abhijit Gupta,
-- so "Covering for" on the SNP worklist has rows while either of them is out
-- of office and Devanshi Sharma covers them. The SNP worklist's Assignee
-- comes from the member's latest SNP care program; a member with no program
-- uses the worklist row. Only unassigned rows are touched.
-- Run on dev, then prod. Safe to re-run.

UPDATE public.patient_care_programs
SET assignee = v.who
FROM (VALUES
  ('pcp-p26-SNP-1',    'Navin Jethwani'),  -- Helen Jackson
  ('pcp-p23-SNP-1',    'Navin Jethwani'),  -- William Davis
  ('pcp-awv-25-SNP-1', 'Abhijit Gupta'),   -- Donna Baker
  ('pcp-p12-SNP-1',    'Abhijit Gupta')    -- Maria Lopez
) AS v(id, who)
WHERE patient_care_programs.id = v.id
  AND (patient_care_programs.assignee IS NULL OR patient_care_programs.assignee IN ('Unassigned', v.who));

-- Glenn Bauch has no SNP program yet, so his worklist row carries it.
UPDATE public.snp_worklist_members m
SET assignee_id = p.id,
    assignee_name = trim(p.full_name),
    assignee_initials = 'AG',
    assignee_role = 'Compliance'
FROM (SELECT id, full_name FROM public.profiles WHERE full_name ILIKE 'abhijit%gupta%' LIMIT 1) p
WHERE m.id = '11171'
  AND (m.assignee_name IS NULL OR m.assignee_name = trim(p.full_name));
