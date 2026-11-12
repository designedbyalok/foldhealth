-- Settings > Calendar > Appointment Types table: description under the name,
-- Booking Span and RSVP Enabled columns. Safe to run more than once; run on
-- dev first, then prod.

ALTER TABLE public.appointment_types ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.appointment_types ADD COLUMN IF NOT EXISTS booking_span text;
ALTER TABLE public.appointment_types ADD COLUMN IF NOT EXISTS rsvp_enabled boolean NOT NULL DEFAULT false;

-- Values for the existing types. Only fills what's empty, so later edits stay.
UPDATE public.appointment_types SET description = 'Yearly preventive visit and care plan review'
  WHERE name = 'Annual Wellness Visit' AND description IS NULL;
UPDATE public.appointment_types SET description = 'Check in on progress after a recent visit'
  WHERE name = 'Follow-up Appointment' AND description IS NULL;
UPDATE public.appointment_types SET description = 'Go over recent lab results with the patient'
  WHERE name = 'Lab Results Discussion' AND description IS NULL;
UPDATE public.appointment_types SET description = 'Referral visit with a specialist'
  WHERE name = 'Specialty Consultation' AND description IS NULL;
UPDATE public.appointment_types SET description = 'Video visit with a provider'
  WHERE name = 'Telehealth Consultation' AND description IS NULL;

UPDATE public.appointment_types SET booking_span = 'Indefinitely into the future'
  WHERE booking_span IS NULL;

UPDATE public.appointment_types SET rsvp_enabled = true
  WHERE name IN ('Annual Wellness Visit', 'Specialty Consultation');
