# Supabase → AWS migration

## Context

This app was spun up as a design-team replica of our main product. The main product already runs on AWS; this migration brings the replica onto the same infra for vendor consolidation.

Current stack:

| Layer | Supabase/Vercel today | AWS target |
|---|---|---|
| Database | Supabase Postgres 17 (free tier, Nano compute) | RDS Postgres 17 (t3.micro or t4g.micro) |
| API over DB | PostgREST (hosted by Supabase) | PostgREST on ECS Fargate |
| Auth | Supabase Auth (GoTrue) | Cognito User Pool |
| Object storage | Supabase Storage | S3 + CloudFront |
| Realtime | Supabase Realtime (3 channels: profiles-watch, msg-inbox, direct_messages) | AppSync subscriptions or API Gateway WebSockets |
| Edge Functions | 2 Supabase Edge Functions (delete-user, featurebase-jwt) | Lambda + API Gateway |
| Hosting | Vercel | Amplify Hosting (closest DX) or S3 + CloudFront + GitHub Actions |
| Transactional email | Resend (API) + O365 for auth email | SES or Mailgun |

Migration budget estimate: 3-5 weeks of focused work. Running cost on AWS roughly $25-45/mo (vs free today, vs $25/mo Supabase Pro).

## Phase index

| Phase | Scope | Rollback | PR |
|---|---|---|---|
| **00** | Prep: dump the Supabase DB, export storage, export user roster. No AWS touched. | Nothing to roll back. | this PR |
| 01 | RDS Postgres + PostgREST on ECS Fargate. Keep Supabase Auth. App env var swap. | Point env var back at Supabase. | separate PR |
| 02 | Supabase Storage → S3. | Feature-flag the storage client. | separate PR |
| 03 | Vercel → Amplify Hosting (or S3 + CloudFront). | Vercel is still linked, DNS flip. | separate PR |
| 04 | Supabase Auth → Cognito. The hardest phase; forces password reset for all 67 users unless we build a bcrypt-hash import. | Supabase Auth is still live, env var swap. | separate PR |
| 05 | Supabase Realtime → AppSync. | Feature-flag the realtime client. | separate PR |
| 06 | Email → SES or Mailgun. | Keep Resend as fallback. | separate PR |
| 07 | Cleanup: delete Supabase project, delete Vercel project, prune env vars. One-way. | Not applicable; leave a 1-week grace period after Phase 06. | separate PR |

Each phase ships independently with its own rollback.

## HIPAA note

If PHI touches this project, every AWS service we land on must be HIPAA-eligible and we need a signed BAA with AWS. All services in the target column above are HIPAA-eligible. See [docs/migration/hipaa-checklist.md] (not yet written) when we get to Phase 04.

## Phase 00 scope (this PR)

Three scripts and three docs. **Zero AWS resources provisioned.** This PR is tooling and runbooks only.

- `scripts/migration/export-supabase-db.sh`: `pg_dump` the production DB to `~/foldhealth-migration/db-YYYYMMDD-HHMM.sql.gz`.
- `scripts/migration/export-storage.sh`, enumerate every Supabase Storage bucket and download its contents.
- `scripts/migration/export-auth-users.mjs`, dump the `auth.users` roster (minus password hashes, which Supabase doesn't expose) to JSON.
- `docs/migration/00-overview.md`, this file.
- `docs/migration/00-prep.md`, step-by-step runbook for executing Phase 00.
- `docs/migration/env-mapping.md`, mapping from every current env var to its AWS equivalent.

## How to use this directory

1. Open the phase's runbook (`docs/migration/0N-*.md`).
2. Follow the steps top to bottom.
3. Each runbook ends with a verification section and a rollback section. Run both.
4. Once a phase is green, open the PR for the next phase.

Do not skip phases. Phases 01-03 are reversible env-var flips; Phase 04 (Cognito) is the point of no return for user accounts.
