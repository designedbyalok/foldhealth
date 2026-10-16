-- Self sign-ups could never confirm their email, and first-time Google /
-- Microsoft sign-ups vanished without a trace.
--
-- BEFORE
-- signup_approval_access_token_hook() refused to mint ANY token for a Pending
-- account. Confirming an email (verifyOtp on the confirmation link) mints a
-- token in the same transaction that sets auth.users.email_confirmed_at, so
-- the refusal rolled the confirmation back. The user saw "This link has
-- expired or was already used", and after an admin approved them, sign-in
-- still failed with "Email not confirmed". Live data: no self sign-up since
-- the hook shipped (2026-09-30) has email_confirmed_at set.
-- OAuth had the same shape, worse: a first OAuth sign-in creates the
-- auth.users row (and, via handle_new_user, a Pending profile) in the same
-- transaction that mints the token, so the refusal deleted the whole account.
-- The user saw "awaiting admin approval" but never appeared under Pending.
--
-- AFTER
-- For a Pending account, a token minted by an email-verification step
-- (email/signup, otp, magiclink) or an OAuth sign-in is allowed so the
-- confirmation / account creation commits, but
-- it is downgraded: role = 'anon' (RLS treats it as signed out) and
-- approval_status = 'pending' so the client signs out and shows the
-- "awaiting approval" message. Password sign-in and token refresh are
-- still refused, so a Pending account never holds a usable session.
-- Rejected accounts are refused for every method, as before.

create or replace function public.signup_approval_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  account_status text;
begin
  select status into account_status
    from public.profiles
   where id = (event->>'user_id')::uuid;

  if account_status = 'Pending' then
    if event->>'authentication_method' in ('email/signup', 'otp', 'magiclink', 'oauth') then
      return jsonb_set(
        event,
        '{claims}',
        (event->'claims') || jsonb_build_object('role', 'anon', 'approval_status', 'pending')
      );
    end if;
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'Your account is awaiting admin approval. You can sign in once an administrator approves your request.'
    ));
  elsif account_status = 'Rejected' then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'Your sign-up request was not approved. Contact your administrator for access.'
    ));
  end if;

  return event;
end;
$$;

-- create or replace keeps existing grants; restated so this file stands alone.
grant execute on function public.signup_approval_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.signup_approval_access_token_hook(jsonb) from public, anon, authenticated;

-- ── Verify ──────────────────────────────────────────────────────────────────
--   select public.signup_approval_access_token_hook(jsonb_build_object(
--     'user_id', '<a Pending profile id>', 'authentication_method', 'email/signup',
--     'claims', jsonb_build_object('role', 'authenticated')));
--   Expect claims.role = 'anon', claims.approval_status = 'pending'.
--   Same with 'oauth'. Same call with 'password' or 'token_refresh' → {"error": {"http_code": 403, ...}}
--
-- ── Rollback ────────────────────────────────────────────────────────────────
--   Re-run section 4 of signup_approval_migration.sql.
