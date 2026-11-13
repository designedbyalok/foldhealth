-- Which practice eFax number (Settings > Messages > eFax) a fax came in on,
-- for the Comms Filters drawer on eFax: By Inbox, and Covering for (the
-- number's linked users are its assignees).
-- Run on dev, then prod. Safe to re-run.

ALTER TABLE public.efax_inbound ADD COLUMN IF NOT EXISTS efax_number_id text;

-- Faxes from before this column came in on the primary office line.
UPDATE public.efax_inbound SET efax_number_id = 'efax-1' WHERE efax_number_id IS NULL;
