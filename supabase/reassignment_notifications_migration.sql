-- VBC-25651: tell each covering provider when appointments are reassigned to
-- them (Figma Eventus Demo 17737:121055):
--   "7 new appointments assigned to you."
--   "Richard reassigned 7 appointments from Emily Carter to you."
--   View Appointments ›
--
-- notifications has no INSERT policy (rows come from triggers only), so a
-- trigger on reassignment_jobs writes one row per covering provider.
-- notifications.reassignment_job_id lets "View Appointments" find which
-- appointments were moved.
--
-- Additive and idempotent: safe to run more than once. Until it runs, the
-- app shows the notification locally to the signed-in user when they are
-- the covering provider.

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS reassignment_job_id text;

CREATE OR REPLACE FUNCTION public.emit_reassignment_notifications()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  IF NEW.status IS DISTINCT FROM 'done' THEN
    RETURN NEW;
  END IF;
  FOR r IN
    SELECT res->>'toId' AS to_id, count(*) AS n
      FROM jsonb_array_elements(coalesce(NEW.results, '[]'::jsonb)) AS res
     WHERE res->>'outcome' = 'reassigned'
       AND res->>'toId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     GROUP BY res->>'toId'
  LOOP
    INSERT INTO public.notifications (recipient_id, actor_name, type, title, body, action, reassignment_job_id)
    VALUES (
      r.to_id::uuid,
      NEW.created_by,
      'appointment.reassigned',
      r.n || CASE WHEN r.n = 1 THEN ' new appointment assigned to you.' ELSE ' new appointments assigned to you.' END,
      coalesce(NEW.created_by, 'Someone') || ' reassigned ' || r.n
        || CASE WHEN r.n = 1 THEN ' appointment' ELSE ' appointments' END
        || ' from ' || coalesce(NEW.from_user, 'another provider') || ' to you.',
      'viewAssignedAppointments',
      NEW.id
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS emit_reassignment_notifications ON public.reassignment_jobs;
CREATE TRIGGER emit_reassignment_notifications
  AFTER INSERT ON public.reassignment_jobs
  FOR EACH ROW EXECUTE FUNCTION public.emit_reassignment_notifications();

NOTIFY pgrst, 'reload schema';
