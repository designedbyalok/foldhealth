-- Staff side of patient portal access (the "Patient Portal" section on a
-- patient's Profile tab). Requires patient_accounts_migration.sql.
--
-- Staff already manage patient_accounts rows directly (link, unlink). What
-- they can't read is the account's email and sign-in state, which live in
-- auth.users. This returns them for one member, staff only.
--
-- Creating an account is not done here: it needs the service role so the
-- account is born with app_metadata.role = 'patient' (see
-- api/_handlers/patient-invite.js).

begin;

create or replace function public.staff_patient_portal_accounts(p_member_id text)
returns table (
  user_id         uuid,
  email           text,
  relationship    text,
  is_primary      boolean,
  linked_at       timestamptz,
  last_sign_in_at timestamptz,
  other_members   integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
    select pa.user_id, u.email::text, pa.relationship, pa.is_primary, pa.created_at, u.last_sign_in_at,
           (select count(*)::int from public.patient_accounts o
             where o.user_id = pa.user_id and o.member_id <> pa.member_id)
      from public.patient_accounts pa
      join auth.users u on u.id = pa.user_id
     where pa.member_id = p_member_id
     order by pa.is_primary desc, pa.created_at;
end;
$$;
revoke execute on function public.staff_patient_portal_accounts(text) from public, anon;
grant execute on function public.staff_patient_portal_accounts(text) to authenticated;

commit;

-- ── Rollback ────────────────────────────────────────────────────────────────
--   drop function if exists public.staff_patient_portal_accounts(text);
