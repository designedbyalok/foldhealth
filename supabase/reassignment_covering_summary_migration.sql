-- Out of Office reassignments (appointments, tasks, care programs in one job):
-- each covering provider gets the reassignment summary of what was moved to
-- them, as the person who ran it does:
--   "Out of Office reassignment summary: you're covering for Navin Jethwani."
--   "3 Appointments • 2 Tasks • 1 Care Program"   → opens the summary (theirs)
-- A job with appointments only keeps the existing notification
-- ("N new appointments assigned to you." → View Appointments).
--
-- Replaces emit_reassignment_notifications from
-- reassignment_notifications_migration.sql (run that first). Idempotent.

CREATE OR REPLACE FUNCTION public.emit_reassignment_notifications()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r record;
  mixed boolean;
  parts text[];
BEGIN
  IF NEW.status IS DISTINCT FROM 'done' THEN
    RETURN NEW;
  END IF;
  -- Any task or care program in the job makes it an Out of Office summary.
  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(NEW.results, '[]'::jsonb)) AS res
     WHERE coalesce(res->>'kind', 'appointment') <> 'appointment'
  ) INTO mixed;
  FOR r IN
    SELECT res->>'toId' AS to_id,
           count(*) FILTER (WHERE coalesce(res->>'kind', 'appointment') = 'appointment') AS appts,
           count(*) FILTER (WHERE res->>'kind' = 'task') AS tasks,
           count(*) FILTER (WHERE res->>'kind' = 'program') AS programs
      FROM jsonb_array_elements(coalesce(NEW.results, '[]'::jsonb)) AS res
     WHERE res->>'outcome' = 'reassigned'
       AND res->>'toId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     GROUP BY res->>'toId'
  LOOP
    IF mixed THEN
      parts := ARRAY[]::text[];
      IF r.appts > 0 THEN parts := parts || (r.appts || CASE WHEN r.appts = 1 THEN ' Appointment' ELSE ' Appointments' END); END IF;
      IF r.tasks > 0 THEN parts := parts || (r.tasks || CASE WHEN r.tasks = 1 THEN ' Task' ELSE ' Tasks' END); END IF;
      IF r.programs > 0 THEN parts := parts || (r.programs || CASE WHEN r.programs = 1 THEN ' Care Program' ELSE ' Care Programs' END); END IF;
      INSERT INTO public.notifications (recipient_id, actor_name, type, title, body, action, reassignment_job_id)
      VALUES (
        r.to_id::uuid,
        NEW.created_by,
        'reassignment.summary',
        'Out of Office reassignment summary: you''re covering for ' || coalesce(NEW.from_user, 'another provider') || '.',
        array_to_string(parts, ' • '),
        'openReassignmentSummary',
        NEW.id
      );
    ELSIF r.appts > 0 THEN
      INSERT INTO public.notifications (recipient_id, actor_name, type, title, body, action, reassignment_job_id)
      VALUES (
        r.to_id::uuid,
        NEW.created_by,
        'appointment.reassigned',
        r.appts || CASE WHEN r.appts = 1 THEN ' new appointment assigned to you.' ELSE ' new appointments assigned to you.' END,
        coalesce(NEW.created_by, 'Someone') || ' reassigned ' || r.appts
          || CASE WHEN r.appts = 1 THEN ' appointment' ELSE ' appointments' END
          || ' from ' || coalesce(NEW.from_user, 'another provider') || ' to you.',
        'viewAssignedAppointments',
        NEW.id
      );
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
