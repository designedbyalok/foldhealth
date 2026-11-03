-- Ask for a reason on care plan status changes (#62), per organization.
--
-- When on, changing a goal, intervention or barrier's status opens the
-- reason dialog (reason required for Met / Resolved, Discontinued and On
-- Hold). Off by default: the status changes straight away and its
-- gbi_status_history row is saved without a reason. An admin turns it on in
-- Settings > Organization.
--
-- RLS is unchanged; the existing org_settings policies cover the column.

ALTER TABLE public.org_settings
  ADD COLUMN IF NOT EXISTS ask_status_change_reason boolean NOT NULL DEFAULT false;
