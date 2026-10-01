-- Holiday configurations (Settings → Calendar → Holiday configuration, and
-- the calendar's Holidays touchpoint).
--
-- One row per holiday: a name, when it starts and ends, the practice
-- locations it applies to (by name, as appointments.location and
-- profiles.locations), and an optional auto reply for calls and messages.
-- On the calendar a holiday shows, and blocks booking, for providers who
-- work at one of its locations.
--
-- Shared by every signed-in user; anon gets no access (as ooo_records).
-- The older public.holidays table (date + name) is left as is.

CREATE TABLE IF NOT EXISTS public.holiday_configurations (
  id                  text PRIMARY KEY,
  name                text NOT NULL,
  start_at            timestamptz NOT NULL,
  end_at              timestamptz NOT NULL,
  locations           text[] NOT NULL DEFAULT '{}',
  auto_reply_message  text NOT NULL DEFAULT '',
  created_by          text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT holiday_configurations_dates_check CHECK (end_at > start_at),
  CONSTRAINT holiday_configurations_name_check CHECK (char_length(name) BETWEEN 1 AND 150)
);
CREATE INDEX IF NOT EXISTS holiday_configurations_range_idx ON public.holiday_configurations (start_at, end_at);
ALTER TABLE public.holiday_configurations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on holiday_configurations" ON public.holiday_configurations;
CREATE POLICY "Allow all on holiday_configurations" ON public.holiday_configurations
  FOR ALL TO authenticated
  USING ((select auth.uid()) is not null) WITH CHECK ((select auth.uid()) is not null);
