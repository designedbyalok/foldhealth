-- Add the Monitoring tab "Story" feed: ordered clinical / outreach / agent /
-- plan / billing events below the "Since you last spoke" briefing.

ALTER TABLE public.patient_monitoring
  ADD COLUMN IF NOT EXISTS story jsonb NOT NULL DEFAULT '[]'::jsonb;
