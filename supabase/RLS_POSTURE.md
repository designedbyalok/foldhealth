# RLS posture: what to do when the linter yells

**tl;dr**, 67 `rls_policy_always_true` warnings on this project are
**expected**. Do not "fix" them by scoping to `auth.uid()` or by role. Read this
file first.

## The model

One practice. Every signed-in staff member is authorized to see every patient,
every chart, every task in the system. That is the product, not a bug,
coders, care coordinators, admins and providers all work the same worklists.

Row-level security here is doing exactly one job: **keep the anonymous
`anon` role (whose key ships in the browser bundle) off every table that
contains PHI**. Every `USING(true) TO authenticated` policy is a faithful
encoding of that model: RLS on, wide open to logged-in humans, closed to
strangers.

The Supabase database linter cannot tell those apart from an accidental hole.
The remediation it suggests, an ownership predicate, has no meaning on this
schema. Of 79 tables under RLS, only 5 carry `tenant_id`, 4 carry `created_by`,
4 carry `user_id`. There is no ownership column to scope the other 66 to.

## What has already been done

The current posture is the product of three deliberate migrations, all in
this directory:

- `narrow_public_policies_to_authenticated.sql`, 68 policies swapped from
  `PUBLIC` (which includes `anon`) to `authenticated`. This is where the
  linter warnings *came from*: the policies used to be wide-open to anybody
  with the anon key, now they are wide-open only to signed-in staff.
- `drop_remaining_anon_policies.sql`, the last few `anon` grants, plus
  narrowing `hcc_activity_log`.
- `profiles_guard_authz_fields.sql`, profile-role writes go through a
  trigger + a SECURITY DEFINER RPC, so the "wide" UPDATE policy on
  `profiles` cannot be used to self-promote to admin.

`forms` and `form_responses` keep narrow anon policies for patient-facing
form-filling (`forms_rls_lockdown_migration.sql`): anon can read ACTIVE
forms only, insert responses, and update rows while still `in_progress`.
Everything else on those tables (reading responses, editing drafts, any
delete) is authenticated-only. Live-probe verified; don't widen them back.

## What the linter still flags, and what to do

**`rls_policy_always_true`, 67 tables**
Accepted. Do not touch. If you scope any of these to
`auth.uid()`, staff will lose access to their colleagues' worklists and the
product will look broken. If you scope by role, non-admin coders and support
users will silently lose write access across the app. The correct answer is
"you must be signed in" and that is what these policies encode.

**`rls_policy_always_true` on `hcc_activity_log_insert`**
Fixed in `hcc_activity_log_stamp_actor.sql`. The insert policy now requires
`actor_id = auth.uid()`, and a BEFORE INSERT trigger stamps it. See that
file's header for why `actor_name` remains client-supplied.

**`hcc_diag_comments`, writes are author-scoped (deliberate)**
Reads stay practice-wide (`USING (true) TO authenticated`), so everyone still
sees every comment. INSERT requires `author_id = auth.uid()` (stamped by a
BEFORE INSERT trigger), and UPDATE / DELETE are limited to the comment's
author, because a comment is personal authorship rather than shared worklist
state. A BEFORE UPDATE trigger pins `author` / `author_id`. Legacy rows with
no `author_id` are read-only for everyone. See
`hcc_diag_comment_author_migration.sql` and
`hcc_diag_comment_rls_and_edit_mentions_migration.sql`. This is the same
ownership pattern as `hcc_activity_log`; it does not generalize to worklist
tables, which have no author.

**`*_security_definer_function_executable`, 5 of 6**
Fixed in `lock_down_security_definer_functions.sql`. `enforce_profile_authz_fields`,
`sync_profile_last_sign_in` and `is_profile_admin` no longer have EXECUTE
grants to anon or authenticated.

**`authenticated_security_definer_function_executable`: `admin_set_user_roles`**
Accepted. It is the sanctioned door from `profiles_guard_authz_fields.sql`:
re-derives the caller's admin status from the DB rather than trusting the
browser, and the client's *only* `.rpc()` call in the whole codebase points at
it. Revoking EXECUTE removes the safe path and pushes role writes back onto
direct table UPDATEs: the exact hole that migration was written to close.

**`auth_leaked_password_protection`**
Not a database migration: a Supabase Auth setting. Enable it in the
dashboard under *Authentication → Providers → Email → Password protection* if
compliance requires it. There is nothing to run here.

## The one rule

Before writing a policy migration in response to a linter warning, check
whether the warning is one of the 67 catalogued above. If it is, and you
still think the policy should be tighter, the change you actually want is a
tenancy model: added `tenant_id` columns, a `tenant_of(user_id)` helper, per-
tenant policies. That is a project, not a lint fix. Scope it separately, do
not backport it a table at a time.
