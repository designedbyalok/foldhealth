# Phase 00: Prep (dump + export)

Goal: hold every piece of data we currently own on Supabase in a local snapshot before we point at anything new. Zero AWS resources are created in this phase.

Target runtime: 15-30 minutes end to end, mostly waiting for `pg_dump`.

## Prerequisites

- You can run `supabase` CLI linked to the Foldhealth project (`supabase projects list` should show status `ACTIVE_HEALTHY`).
- `pg_dump` and `psql` installed locally. On macOS: `brew install postgresql@17`.
- `aws-cli` installed and configured against the target AWS account. Needed later; not strictly needed for this phase, but good to confirm now with `aws sts get-caller-identity`.
- About 1 GB of free disk space in `~/foldhealth-migration/`.
- `SUPABASE_DB_PASSWORD` already in `.env` (it is).

## Step 1: snapshot the database

Run from the repo root:

```bash
bash scripts/migration/export-supabase-db.sh
```

The script wraps `pg_dump` through the Supabase session pooler. Output lands at `~/foldhealth-migration/db-YYYYMMDD-HHMM.sql.gz`.

Expected size for the current project: 15-25 MB compressed.

Verify:

```bash
ls -lh ~/foldhealth-migration/db-*.sql.gz
gunzip -t ~/foldhealth-migration/db-*.sql.gz && echo OK
```

Keep the dump. We restore it into RDS in Phase 01.

## Step 2: export storage buckets

```bash
bash scripts/migration/export-storage.sh
```

The script lists every bucket in the project, then downloads all objects into `~/foldhealth-migration/storage/<bucket>/`.

Verify:

```bash
du -sh ~/foldhealth-migration/storage/*
```

Expected: tens of MB total today. Letters, PDFs, a few avatars.

## Step 3: export the user roster

```bash
node scripts/migration/export-auth-users.mjs
```

Writes `~/foldhealth-migration/auth-users.json` with every row from `auth.users`. Password hashes are not accessible via the Supabase API, the file carries ids, emails, metadata, and timestamps only. Phase 04 (Cognito) will force a password reset per user, unless we build a bcrypt-hash import path at that time.

Verify:

```bash
jq 'length' ~/foldhealth-migration/auth-users.json
```

Expected: current head count (around 70).

## Step 4: inventory env vars

Open [docs/migration/env-mapping.md]. For each current var, note its target destination. If a var depends on something not listed, add a row.

Verify: `env-mapping.md` has no `TBD` left for a var that's actually in use.

## Rollback

Nothing to roll back. Delete `~/foldhealth-migration/` if you want to redo.

## Done when

- [ ] `~/foldhealth-migration/db-*.sql.gz` exists and `gunzip -t` passes.
- [ ] `~/foldhealth-migration/storage/` has one subdirectory per Supabase bucket.
- [ ] `~/foldhealth-migration/auth-users.json` exists and the user count matches the dashboard.
- [ ] `docs/migration/env-mapping.md` has no `TBD` on an in-use var.

Then open PR 01.
