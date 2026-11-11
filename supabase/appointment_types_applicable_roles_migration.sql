-- Add availability for multiple users (VBC-26548): Review skips a user when
-- no active appointment type is applicable for their role.
--   applicable_roles: the clinical roles a type can be booked with (empty = everyone)
--   active:           inactive types never count as applicable
-- Safe to run more than once; run on dev first, then prod.

ALTER TABLE public.appointment_types ADD COLUMN IF NOT EXISTS applicable_roles text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.appointment_types ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- Existing types: bookable with clinical providers (matches
-- DEFAULT_APPLICABLE_ROLES in src/features/settings/calendar/availability/bulkAvailability.js).
-- Only fills types that have no roles yet, so a later edit isn't overwritten.
UPDATE public.appointment_types
SET applicable_roles = ARRAY['Physician/Doctor', 'Physician', 'Nurse Practitioner', 'Nurse']
WHERE applicable_roles = '{}';
