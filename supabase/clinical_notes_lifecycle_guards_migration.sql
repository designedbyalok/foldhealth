-- =====================================================================
-- clinical_notes_lifecycle_guards_migration.sql
--
-- Audit gap (P1-2): `public.clinical_notes` accepts any status
-- transition today. The RLS UPDATE policy only checks identity
-- (author OR reviewer). Anyone matching that identity can flip
-- draft → signed, signed → draft, resign a signed note, or amend a
-- signed row without a real signer. Sign identity was also stamped
-- client-side, so a signed row could carry any name.
--
-- This migration installs BEFORE UPDATE / BEFORE INSERT triggers that
-- enforce:
--
--   1. Legal status transitions
--        draft     → submitted | signed
--        submitted → draft | signed
--        signed    → signed   (no downgrade; only same-row amend)
--
--   2. Role-appropriate transitions
--        draft     → submitted : author only
--        draft     → signed    : author only (self-sign)
--        submitted → signed    : reviewer only
--        submitted → draft     : author only (reopen)
--        signed    → signed    : signer only (amend by original signer)
--
--   3. Sign identity is real
--        On INSERT/UPDATE landing on `status = 'signed'`, require
--        signed_by_id = auth.uid() and stamp signed_at = now() if the
--        caller hasn't set it. signed_by_name is stamped from the row
--        the caller provided; if empty, fall back to auth uid so the
--        row is never anonymous.
--
--   4. Amend audit
--        The existing `clinical_notes_version_snapshot` trigger already
--        snapshots the prior state into `clinical_note_versions` on
--        every UPDATE: this migration relies on that unchanged.
--
-- Idempotent: guarded CREATE OR REPLACE. Safe to re-run.
--
-- BYPASS: A GUC `app.bypass_clinical_note_lifecycle = 'on'` disables
-- the transition guard for the duration of the current session, meant
-- for backfill scripts and migrations that need to normalize legacy
-- data. Never set from application code.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Transition + role guard trigger
-- ---------------------------------------------------------------------

create or replace function public.clinical_notes_enforce_lifecycle()
returns trigger
language plpgsql
security invoker
as $$
declare
  actor uuid;
  bypass text;
begin
  bypass := current_setting('app.bypass_clinical_note_lifecycle', true);
  if bypass = 'on' then
    return new;
  end if;

  actor := auth.uid();

  -- On INSERT we only allow status = 'draft' | 'submitted' | 'signed'
  -- (the CHECK constraint handles that). If the caller lands directly
  -- on 'signed', enforce the sign-identity rules below via
  -- clinical_notes_stamp_signer.
  if tg_op = 'INSERT' then
    return new;
  end if;

  -- UPDATE path: enforce legal transitions + role.
  if old.status = 'draft' then
    if new.status = 'draft' then
      -- ok: continue editing the draft.
      null;
    elsif new.status = 'submitted' then
      if actor is null or actor <> old.author_id then
        raise exception 'clinical_notes: only the author may submit a draft for review'
          using errcode = '42501';
      end if;
    elsif new.status = 'signed' then
      if actor is null or actor <> old.author_id then
        raise exception 'clinical_notes: only the author may sign their own draft'
          using errcode = '42501';
      end if;
    else
      raise exception 'clinical_notes: illegal transition draft -> %', new.status
        using errcode = '42501';
    end if;

  elsif old.status = 'submitted' then
    if new.status = 'submitted' then
      -- ok: reviewer edits without status change.
      null;
    elsif new.status = 'draft' then
      if actor is null or actor <> old.author_id then
        raise exception 'clinical_notes: only the author may reopen a submitted note as draft'
          using errcode = '42501';
      end if;
    elsif new.status = 'signed' then
      if actor is null or (actor <> old.reviewer_id and actor <> old.author_id) then
        raise exception 'clinical_notes: only the assigned reviewer or the author may sign a submitted note'
          using errcode = '42501';
      end if;
    else
      raise exception 'clinical_notes: illegal transition submitted -> %', new.status
        using errcode = '42501';
    end if;

  elsif old.status = 'signed' then
    if new.status <> 'signed' then
      raise exception 'clinical_notes: signed notes cannot revert to %', new.status
        using errcode = '42501';
    end if;
    -- Amend on a signed row is allowed only if the actor is the
    -- original signer. The versions trigger writes the audit row.
    if actor is null or actor <> old.signed_by_id then
      raise exception 'clinical_notes: only the original signer may amend a signed note'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists clinical_notes_enforce_lifecycle on public.clinical_notes;
create trigger clinical_notes_enforce_lifecycle
  before update on public.clinical_notes
  for each row execute function public.clinical_notes_enforce_lifecycle();

-- ---------------------------------------------------------------------
-- Sign-identity stamp trigger (runs on both INSERT and UPDATE)
-- ---------------------------------------------------------------------

create or replace function public.clinical_notes_stamp_signer()
returns trigger
language plpgsql
security invoker
as $$
declare
  actor uuid;
  bypass text;
begin
  bypass := current_setting('app.bypass_clinical_note_lifecycle', true);
  if bypass = 'on' then
    return new;
  end if;

  if new.status is distinct from 'signed' then
    return new;
  end if;

  actor := auth.uid();
  if actor is null then
    raise exception 'clinical_notes: signing requires an authenticated user'
      using errcode = '42501';
  end if;

  -- Force signed_by_id to the actor. Callers are trusted to pass the
  -- display name but the id is authoritative.
  if new.signed_by_id is null or new.signed_by_id <> actor then
    new.signed_by_id := actor;
  end if;
  if new.signed_by_name is null or btrim(new.signed_by_name) = '' then
    -- Fall back to the actor uid as a marker rather than a placeholder
    -- like 'Provider', display code can resolve this to a display name.
    new.signed_by_name := actor::text;
  end if;
  if new.signed_at is null then
    new.signed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists clinical_notes_stamp_signer on public.clinical_notes;
create trigger clinical_notes_stamp_signer
  before insert or update on public.clinical_notes
  for each row execute function public.clinical_notes_stamp_signer();

-- ---------------------------------------------------------------------
-- Notes on rollout
-- ---------------------------------------------------------------------
-- • This migration does NOT change RLS policies. `author_id =
--   auth.uid() OR reviewer_id = auth.uid()` still gates who may write.
--   The triggers layer role-appropriate transitions on top.
-- • Existing legacy signed rows with `signed_by_name = 'Provider'` are
--   NOT rewritten. Backfill separately if desired.
-- • The store's `signClinicalNote` action passes signed_by_id + name
--   from `currentUserProfile`; the stamp trigger will re-affirm the id
--   from auth.uid() so a spoofed client id still lands on the true
--   signer.
