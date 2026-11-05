-- =====================================================================
-- note_templates_migration.sql
--
-- Audit gap (P2-1): field definitions for every Care Gap Note Template
-- lived in `src/features/hedis-worklist/ClinicalNotePanel.utils.js` as a
-- JS constant (`GAP_TEMPLATES`). Rows in `public.forms` with
-- form_type='Note' carried the template's NAME and DESCRIPTION but not
-- the field schema, and there was no mapping between a gap code and its
-- default template. Notes referenced templates only via a text
-- `clinical_notes.form_type` enum: no FK, no per-gap resolution.
--
-- This migration promotes `forms` to be the DB-backed source of truth
-- for Note Templates:
--
--   • forms.gap_code text, which HEDIS gap the template covers
--                                    (null for non-Note forms).
--   • forms.is_default_for_gap bool, marks the default template when a
--                                    gap has more than one.
--   • forms.field_kind text, 'note' (default) so future non-note
--                                    forms can share the schema shape.
--   • forms.schema jsonb, already exists on the table; this
--                                    migration populates it via a
--                                    companion script:
--                                      bun scripts/sync-note-templates.mjs
--                                    See scripts/sync-note-templates.mjs
--                                    for the JS → JSONB pump.
--
--   • clinical_notes.form_id bigint FK REFERENCES forms(id) ON DELETE
--     SET NULL: reverse traceability from a persisted note back to the
--     template that authored it.
--
-- Idempotent; safe to re-run.
--
-- Lifecycle guard bypass
-- The tail backfill runs `update public.clinical_notes set form_id = ...`,
-- which trips the `clinical_notes_enforce_lifecycle` trigger (installed by
-- clinical_notes_lifecycle_guards_migration.sql) because migrations run as
-- the postgres role, not auth.uid(). The trigger exposes an escape hatch
-- via `app.bypass_clinical_note_lifecycle = 'on'` for exactly this case
-- (admin backfill, no app-level identity). SET LOCAL scopes it to this
-- migration's implicit transaction, so nothing else on the connection
-- inherits the bypass.
-- =====================================================================

set local app.bypass_clinical_note_lifecycle = 'on';

-- ---------------------------------------------------------------------
-- forms: gap linkage + default flag
-- ---------------------------------------------------------------------

alter table public.forms
  add column if not exists gap_code text,
  add column if not exists is_default_for_gap boolean not null default true;

comment on column public.forms.gap_code is
  'HEDIS gap code (e.g. CBP, DM, EED) this Note Template covers. Null for non-Note forms.';
comment on column public.forms.is_default_for_gap is
  'Marks the default template when a single gap has more than one. Only one row per gap_code should be true; enforced by a partial unique index below.';

-- Backfill: match every Note-form's name pattern "<CODE> Visit Note"
-- (with the trailing " Visit Note" stripped) to a gap code. Rows that
-- don't match the pattern (Consolidated Clinical Note, etc.) stay
-- null and simply aren't part of the gap → template resolution map.
update public.forms
   set gap_code = regexp_replace(name, '\s+Visit Note$', '')
 where gap_code is null
   and form_type = 'Note'
   and name ~* '^[A-Z0-9]{2,10}(-[A-Z0-9]{1,5})?\s+Visit Note$';

-- Only one default template per gap. Skip if it already exists.
create unique index if not exists forms_gap_code_default_idx
  on public.forms (gap_code)
  where is_default_for_gap = true and gap_code is not null;

create index if not exists forms_gap_code_idx
  on public.forms (gap_code)
  where gap_code is not null;

-- ---------------------------------------------------------------------
-- clinical_notes: form_id FK back to the template
-- ---------------------------------------------------------------------

alter table public.clinical_notes
  add column if not exists form_id bigint;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'clinical_notes_form_id_fkey'
       and conrelid = 'public.clinical_notes'::regclass
  ) then
    alter table public.clinical_notes
      add constraint clinical_notes_form_id_fkey
      foreign key (form_id)
      references public.forms (id)
      on delete set null;
  end if;
end$$;

comment on column public.clinical_notes.form_id is
  'Template that authored this note (references forms.id). Null on legacy rows written before this column existed; the JS side falls back to form_type/gap_codes to resolve the template.';

create index if not exists clinical_notes_form_id_idx
  on public.clinical_notes (form_id)
  where form_id is not null;

-- Backfill form_id where the single-gap Note maps cleanly to one
-- Note form (e.g. gap_codes=['CBP'] → forms row with gap_code='CBP').
-- Consolidated notes (multi-gap) stay unresolved: no single template
-- covers them; we'd need a dedicated "Consolidated Clinical Note"
-- template row for that, added later.
update public.clinical_notes cn
   set form_id = f.id
  from public.forms f
 where cn.form_id is null
   and array_length(cn.gap_codes, 1) = 1
   and f.form_type = 'Note'
   and f.gap_code = cn.gap_codes[1]
   and f.is_default_for_gap = true;
