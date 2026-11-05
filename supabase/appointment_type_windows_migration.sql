-- Appointment types: "Limit cancel or reschedule time".
-- How long before an appointment patients can still cancel or reschedule it
-- themselves, in minutes. Null means up to the time of the appointment.
-- Staff can still act inside the window; Bulk Cancel and Bulk Reschedule
-- flag those appointments for review first.

alter table public.appointment_types
  add column if not exists cancel_window_minutes integer,
  add column if not exists reschedule_window_minutes integer;

-- Windows on two types, so the review step can be demoed.
update public.appointment_types
  set cancel_window_minutes = 1440, reschedule_window_minutes = 1440
  where name = 'Annual Wellness Visit' and cancel_window_minutes is null and reschedule_window_minutes is null;

update public.appointment_types
  set cancel_window_minutes = 240, reschedule_window_minutes = 120
  where name = 'Follow-up Appointment' and cancel_window_minutes is null and reschedule_window_minutes is null;
