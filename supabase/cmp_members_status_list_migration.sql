-- CMP program statuses are now Declined, New, Unable to Reach, Enrolled,
-- Attempted and Engaged. Rows saved with the two retired values move to
-- their new names: Open becomes New, Engaged - Requires Follow Up becomes
-- Engaged (the follow-up still shows through Next Action Due).

UPDATE public.cmp_members SET program_sub_status = 'New'
  WHERE program_sub_status = 'Open';
UPDATE public.cmp_members SET program_sub_status = 'Engaged'
  WHERE program_sub_status = 'Engaged - Requires Follow Up';
