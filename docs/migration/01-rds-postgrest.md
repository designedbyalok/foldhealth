# Phase 01: RDS Postgres + PostgREST on ECS Fargate

Goal: stand up a self-hosted replica of Supabase's DB plane on AWS, restore the Phase 00 dump into it, and leave the app pointing at Supabase (for now). The app-side cutover is a separate PR (Phase 01-B).

Target runtime: 25-40 minutes end to end, mostly waiting for RDS provisioning (12-18 min) and the restore (1-3 min).

## Prerequisites

- Phase 00 complete. You have `~/foldhealth-migration/db-*.sql.gz`.
- Terraform ≥ 1.6 installed.
- AWS CLI configured against the target account (`aws sts get-caller-identity` works).
- The Supabase JWT secret, copied from the Supabase dashboard: Settings → API → JWT Secret. We paste it into Secrets Manager via a `TF_VAR_*` env var so it never lives in a file.
- (Optional) A Route 53 hosted zone you own, if you want PostgREST on `api.yourdomain.com` instead of the raw ALB DNS name.

## Step 1: review and apply the Terraform

```bash
cd infra/terraform

export TF_VAR_supabase_jwt_secret='<paste secret here>'
export TF_VAR_aws_region=ap-southeast-1    # or us-east-1
# optional, for a nice DNS name:
# export TF_VAR_alb_subdomain=api
# export TF_VAR_route53_zone_name=foldhealth.org

terraform init
terraform plan
```

Expected plan: ~35 resources create. Nothing to destroy. If the plan wants to destroy anything, stop and investigate.

```bash
terraform apply
```

Wait for the apply to complete. RDS is the long pole.

Verify:

```bash
terraform output
# rds_endpoint = "foldhealth-prod-postgres.XXXXXXXX.ap-southeast-1.rds.amazonaws.com"
# rds_password_secret_arn = "arn:aws:secretsmanager:..."
# postgrest_url = "http://foldhealth-prod-postgrest-...elb.amazonaws.com"  (or https:// if DNS was wired)
```

## Step 2: restore the dump

The RDS instance lives on private subnets. From a dev machine you have three choices:

- **Easiest**: temporarily flip `publicly_accessible=true` and tighten the RDS security group to your current IP for the duration of the restore. See the "Dev-machine restore" section below.
- **Cleanest**: spin up a small bastion EC2 in the public subnet, run the restore from there, then terminate it.
- **Nicest if you'll do this often**: run the restore from a one-off ECS exec session in the same VPC as the RDS.

For a one-time Phase 01 restore, choose the first.

### Dev-machine restore

```bash
# Allow your IP, temporarily
MY_IP="$(curl -s https://checkip.amazonaws.com)/32"
RDS_SG="$(cd infra/terraform && terraform state show module.rds.aws_security_group.rds | awk '/^ *id/ { print $3; exit }' | tr -d '"')"

aws rds modify-db-instance \
  --db-instance-identifier foldhealth-prod-postgres \
  --publicly-accessible --apply-immediately

aws ec2 authorize-security-group-ingress \
  --group-id "$RDS_SG" --protocol tcp --port 5432 --cidr "$MY_IP" \
  --tag-specifications "ResourceType=security-group-rule,Tags=[{Key=purpose,Value=phase-01-restore}]"

# Wait for the DB to re-attach the public IP
aws rds wait db-instance-available --db-instance-identifier foldhealth-prod-postgres

# Run the restore
bash scripts/migration/restore-to-rds.sh
```

Verify spot-check output:

```
public_tables | rls_policies | triggers | db_size
--------------+--------------+----------+---------
          ~80 |          ~90 |      ~15 | ~40 MB
```

Then revoke public access:

```bash
aws ec2 revoke-security-group-ingress \
  --group-id "$RDS_SG" --protocol tcp --port 5432 --cidr "$MY_IP"

aws rds modify-db-instance \
  --db-instance-identifier foldhealth-prod-postgres \
  --no-publicly-accessible --apply-immediately
```

## Step 3: verify PostgREST

Hit the ALB directly with a known-anon query:

```bash
POSTGREST_URL="$(cd infra/terraform && terraform output -raw postgrest_url)"

# Should return 200 with an empty body (schema introspection; no RLS reads)
curl -i "$POSTGREST_URL/"

# A real table query: profiles is SELECT-open to anon in the current schema
curl -i "$POSTGREST_URL/profiles?limit=1" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}"
```

If the second returns 200 with JSON, PostgREST is validating Supabase's anon JWT against the shared secret, hitting RDS, honoring RLS, and shaping the response identically to Supabase's hosted PostgREST.

## Step 4: do not switch the app yet

The app continues to point at Supabase. Phase 01-B swaps `VITE_API_URL` to this ALB in a separate PR after you've verified the new PostgREST responds correctly for a few representative queries.

## Done when

- [ ] `terraform apply` completed, outputs are populated.
- [ ] Restore spot-check shows the expected table / policy / trigger counts and DB size.
- [ ] `curl $POSTGREST_URL/profiles?limit=1` returns the same shape as the Supabase REST equivalent.
- [ ] RDS is back on private-only (`publicly_accessible=false`).
- [ ] Security group has no leftover rules tagged `purpose=phase-01-restore`.

Then open PR 01-B (app dual-client).

## Rollback

Phase 01 provisions AWS resources but changes nothing in the live app. Rollback is `terraform destroy` after flipping deletion protection off on RDS:

```bash
aws rds modify-db-instance \
  --db-instance-identifier foldhealth-prod-postgres \
  --no-deletion-protection --apply-immediately
cd infra/terraform && terraform destroy
```

See [01-rollback.md](01-rollback.md) for the detailed procedure.
