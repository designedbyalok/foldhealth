-- TOC AI Outcome workflow: track whether bulk TOC agent invoke has started
-- the AI outcome column for a patient. NULL/true = show computed outcome;
-- false = blank until the user invokes the TOC agent from the bulk bar.

BEGIN;

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS ai_outcome_initiated BOOLEAN DEFAULT true;

-- First 5 agent-assigned patients (by numeric id) start with a blank AI Outcome.
UPDATE public.patients
SET ai_outcome_initiated = false
WHERE id IN (
  SELECT id
  FROM public.patients
  WHERE agent_assigned IS NOT NULL AND agent_assigned <> ''
  ORDER BY CAST(regexp_replace(id, '\D', '', 'g') AS INTEGER) ASC
  LIMIT 5
);

COMMIT;
