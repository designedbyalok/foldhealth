-- Care plan notes: tags and links (rich care note box).
--
-- A plan-level care note can tag care team members with "@" and link the
-- plan's goals, interventions and barriers with "/". The note row keeps its
-- plain text in `detail` and the rest here:
--   { "html": "...", "mentions": [{ "id", "name" }], "links": [{ "id", "kind", "label" }] }
-- Each linked item also gets its own `note_linked` row (no schema change), so
-- the note shows in that item's activity log.
--
-- The app sends `meta` only when a note has it and retries without it if the
-- column is missing, so notes keep saving before this runs.

ALTER TABLE care_plan_audit ADD COLUMN IF NOT EXISTS meta jsonb;
