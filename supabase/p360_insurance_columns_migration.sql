-- ============================================================
-- Profile tab / Insurance view: extend p360_profiles with the
-- primary-insurance + policyholder fields that back the Update
-- Member drawer's Insurance Details step (Figma P360 Revamp
-- 6821:316529) and the Insurance segmented view on the Profile
-- tab (Figma 526:334385).
-- ============================================================
--
-- Every `ADD COLUMN IF NOT EXISTS` is idempotent so this migration is
-- safe to re-run. The Edit Patient drawer's form state already carries
-- values under these exact keys: `updateP360Profile` / `invitePatient`
-- will start persisting them once the columns exist.

-- ── Primary Insurance ─────────────────────────────────────────
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS insurance_carrier_name      TEXT;
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS insurance_plan_name         TEXT;
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS insurance_member_id         TEXT;
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS insurance_snp_type          TEXT;
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS insurance_lob               TEXT;
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS insurance_employment_status TEXT;
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS insurance_group_id          TEXT;
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS insurance_eligibility_start TEXT;
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS insurance_eligibility_end   TEXT;
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS insurance_benefits_effective TEXT;
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS insurance_benefits_termed   TEXT;
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS insurance_deductible        TEXT;
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS insurance_max_oop           TEXT;
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS insurance_copay             TEXT;
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS insurance_cost_sharing_level TEXT;
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS insurance_part_d_lis_level  TEXT;
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS insurance_extra_benefits    TEXT;

-- ── Policyholder ──────────────────────────────────────────────
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS ph_relationship  TEXT;
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS ph_policy_id     TEXT;
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS ph_first_name    TEXT;
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS ph_last_name     TEXT;
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS ph_date_of_birth TEXT;
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS ph_sex_at_birth  TEXT;

-- ── Verify ────────────────────────────────────────────────────
--   select column_name from information_schema.columns
--    where table_name = 'p360_profiles'
--      and (column_name like 'insurance_%' or column_name like 'ph_%')
--    order by column_name;
--   Expect 23 rows (17 insurance_* + 6 ph_*).
