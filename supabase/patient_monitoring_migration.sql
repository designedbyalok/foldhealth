-- Patient Monitoring: the per-patient snapshot behind the P360 "Monitoring"
-- tab (the Care Management prototype's patient workspace).
--
-- THE HOLE THIS CLOSES
-- The Monitoring tab shows a fixed-layout snapshot of an active care episode:
-- a discharge/TCM banner, risk + utilization + continuity, program step
-- progress (TCM / CCM), a "since you last spoke" briefing, and the open
-- tasks / active goals / care gaps rail. None of that had a home; this table
-- gives one monitoring row per patient, keyed by the customer-facing member id
-- so it lines up with every worklist slice.
--
-- SHAPE
-- Snapshot scalars are columns (queryable: adherence, program minutes, risk).
-- The repeating, ordered, UI-local structures (program steps, timeline items,
-- tasks, goals, gaps, header chips) are jsonb, same treatment as
-- care_plan_templates, where the entries are ordered display rows rather than
-- rows worth their own table + joins for this surface.
--
-- RLS
-- Per RLS_POSTURE.md: on, wide open to `authenticated`, closed to `anon`.
-- Staff clinical data with no per-row ownership column to scope by.

CREATE TABLE IF NOT EXISTS public.patient_monitoring (
  member_id                 text PRIMARY KEY,
  banner_text               text,
  banner_due                text,
  phone_flags               text,            -- e.g. "SMS ok · no voicemail"
  risk_raf                  numeric,
  risk_trend                text,            -- e.g. "↑ 12 mo"
  risk_tier                 text,            -- High | Rising | Moderate
  util_ed_90d               int,
  util_ip_90d               int,
  util_note                 text,
  continuity_last           text,
  continuity_next           text,
  days_since_discharge      int,
  discharge_label           text,
  program_minutes           int,
  program_minutes_threshold int,
  threshold_label           text,
  open_tasks                int,
  adherence                 int,             -- 0-100 care-plan adherence
  header_chips              jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{label, tone?}]
  programs                  jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{code,name,progress,next,steps:[…]}]
  timeline                  jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{text, source}]
  story                     jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{at, category, title, body, icon?, iconTone?}]
  tasks                     jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{title, sub, tone}]
  goals                     jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{text, conf}]
  gaps                      jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{label, meta}]
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- Forward-safe: `story` was added after the first cut of this file, so a
-- database that already created the table above still picks it up.
ALTER TABLE public.patient_monitoring
  ADD COLUMN IF NOT EXISTS story jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.patient_monitoring ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage patient_monitoring" ON public.patient_monitoring;
CREATE POLICY "Staff manage patient_monitoring"
  ON public.patient_monitoring FOR ALL TO authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
