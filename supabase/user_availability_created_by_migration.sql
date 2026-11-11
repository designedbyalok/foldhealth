-- Add availability for multiple users (VBC-26548): each schedule records who
-- added it (created_at already exists). Safe to run more than once; run on
-- dev first, then prod.

ALTER TABLE public.user_availability ADD COLUMN IF NOT EXISTS created_by text;
