-- User availability (Settings → Calendar → User availability): when each
-- provider can be booked. One row per availability block: a location and
-- timezone, a repeat pattern, a date range, and one or more time ranges per
-- appointment type.
--
-- advanced: false = weekly on `days`; true = the options below apply
-- repeat:   daily | weekly | monthly
-- repeat_interval: every N days / weeks / months (1 = every one)
-- days:     weekdays, 0 = Sunday … 6 = Saturday (unused for daily)
-- weeks:    for monthly, which occurrences of those weekdays: 1–5, -1 = last
-- slots:  [{ "appointmentType": "All appointment types", "start": "09:00", "end": "17:00" }]
--
-- Users with no rows here take their locations' practice availability.
-- Read and written only by the signed-in app.

CREATE TABLE IF NOT EXISTS public.user_availability (
  id             text PRIMARY KEY,
  user_id        text,
  user_name      text NOT NULL,
  user_email     text,
  location       text NOT NULL,
  timezone       text NOT NULL,
  advanced       boolean NOT NULL DEFAULT false,
  repeat         text NOT NULL DEFAULT 'weekly',
  repeat_interval integer NOT NULL DEFAULT 1,
  days           integer[] NOT NULL DEFAULT '{}',
  weeks          integer[] NOT NULL DEFAULT '{}',
  start_date     date NOT NULL,
  end_date       date NOT NULL,
  slots          jsonb NOT NULL DEFAULT '[]'::jsonb,
  skip_holidays  boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- For a table made from an earlier version of this file.
ALTER TABLE public.user_availability ADD COLUMN IF NOT EXISTS advanced boolean NOT NULL DEFAULT false;
ALTER TABLE public.user_availability ADD COLUMN IF NOT EXISTS repeat_interval integer NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS user_availability_user_idx ON public.user_availability (user_name);

ALTER TABLE public.user_availability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on user_availability" ON public.user_availability;
CREATE POLICY "Allow all on user_availability" ON public.user_availability
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
