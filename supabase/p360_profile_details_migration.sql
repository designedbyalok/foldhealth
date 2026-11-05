-- ============================================================
-- Profile tab: extend p360_profiles with the demographic /
-- address / other-info fields that back the Patient → Profile tab
-- (Figma Fold-Pixel 1.0 node 6820:269258).
-- ============================================================
--
-- Every `ADD COLUMN IF NOT EXISTS` is idempotent, so this migration is
-- safe to re-run. The store's fetchP360Profile() reads with `select('*')`
-- and returns the row verbatim, so no store change is required to pick
-- these fields up once the columns exist and are populated.

-- ── Basic Info ─────────────────────────────────────────────────
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS chosen_name         TEXT;
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS date_of_birth       TEXT;   -- MM/DD/YYYY for display parity
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS gender_identity     TEXT;   -- "Identified as Female"
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS pronoun             TEXT;   -- "She/Her"
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS sex_at_birth        TEXT;   -- "Female"
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS sexual_orientation  TEXT;
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS primary_language    TEXT;
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS secondary_language  TEXT;
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS blood_group         TEXT;   -- "O +ve"
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS marital_status      TEXT;
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS race                TEXT;
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS ethnicity           TEXT;
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS ipa                 TEXT;

-- ── Address ────────────────────────────────────────────────────
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS address_line1       TEXT;
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS address_line2       TEXT;
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS city                TEXT;
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS state               TEXT;
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS zipcode             TEXT;
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS location_landmark   TEXT;   -- "7 Hill Department"

-- ── Other Info ─────────────────────────────────────────────────
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS profile_source      TEXT;   -- "EHR sync", "Manual", …
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS profile_created_on  TEXT;   -- MM/DD/YYYY
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS employer            TEXT;
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS practice_location   TEXT;
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS age                 TEXT;   -- "72", "63y 2m", …
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS tags                JSONB DEFAULT '[]'::jsonb;
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS custom_fields       JSONB DEFAULT '[]'::jsonb; -- [{ label, value }]
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS extra_languages     JSONB DEFAULT '[]'::jsonb; -- string[]: extras beyond Primary/Secondary
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS extra_phones        JSONB DEFAULT '[]'::jsonb; -- [{ number, hours }]
ALTER TABLE p360_profiles ADD COLUMN IF NOT EXISTS additional_notes    TEXT;

-- ── Seed extended fields for the demo patients ──
-- family_members is re-set to include phone + hours + role so the Contact
-- Info block on the Profile tab can render each contact card with the
-- Primary / Caregiver badge and phone number line.

UPDATE p360_profiles SET
  chosen_name         = 'Annette',
  date_of_birth       = '03/29/1951',
  gender_identity     = 'Identified as Female',
  pronoun             = 'She/Her',
  sex_at_birth        = 'Female',
  sexual_orientation  = '-',
  primary_language    = 'En(US-Native)',
  secondary_language  = 'zh(Yue-basic)',
  blood_group         = 'O +ve',
  marital_status      = 'Married',
  race                = 'White',
  ethnicity           = 'Chinese',
  ipa                 = 'LA Care',
  address_line1       = '171 Bruen Ville',
  address_line2       = '-',
  city                = 'New York',
  state               = 'New York',
  zipcode             = '34428',
  location_landmark   = '7 Hill Department',
  profile_source      = 'EHR sync',
  profile_created_on  = '04/29/2022',
  employer            = 'Fox Valley Tools & Die',
  family_members      = '[
    {"name": "John Lane",   "relation": "Brother", "initials": "JL", "role": "Primary",   "phone": "(595) 444-0234", "phone_hours": "Mon-Sun, 9am-9pm"},
    {"name": "Nina Rogers", "relation": "Sister",  "initials": "NR", "role": "Caregiver", "phone": "(595) 494-0230", "phone_hours": "Mon-Sun, 9am-9pm"},
    {"name": "Katy Moss",   "relation": "Sister",  "initials": "KM", "role": null,         "phone": "(595) 209-6666", "phone_hours": "Mon-Sun, 9am-9pm"}
  ]'::jsonb
WHERE patient_id = 'p1';

-- p17 is the demo patient linked from the TOC worklist; give it a
-- distinct-but-consistent identity so the Profile tab reads as real data
-- rather than a copy of p1.
INSERT INTO p360_profiles (patient_id, profile_type) VALUES ('p17', 'Central Profile')
ON CONFLICT (patient_id) DO NOTHING;

UPDATE p360_profiles SET
  chosen_name         = 'Carl',
  date_of_birth       = '09/14/1968',
  gender_identity     = 'Identified as Male',
  pronoun             = 'He/Him',
  sex_at_birth        = 'Male',
  sexual_orientation  = '-',
  primary_language    = 'Es(US-Native)',
  secondary_language  = 'En(Basic)',
  blood_group         = 'A +ve',
  marital_status      = 'Married',
  race                = 'Hispanic',
  ethnicity           = 'Latino',
  ipa                 = 'FoldHealth',
  address_line1       = '482 Alameda Ave',
  address_line2       = 'Apt 3B',
  city                = 'Los Angeles',
  state               = 'California',
  zipcode             = '90019',
  location_landmark   = 'Central Community Clinic',
  profile_source      = 'EHR sync',
  profile_created_on  = '02/11/2023',
  employer            = 'Ramirez Landscaping Co.',
  emails              = '["carlos.hernandez@email.com"]'::jsonb,
  plan_numbers_primary = '["(323) 555-0119"]'::jsonb,
  languages           = '["Spanish", "English"]'::jsonb,
  language_preference = 'Spanish',
  family_members      = '[
    {"name": "Elena Hernandez", "relation": "Wife",   "initials": "EH", "role": "Primary",   "phone": "(323) 555-0142", "phone_hours": "Mon-Sun, 9am-9pm"},
    {"name": "Mateo Hernandez", "relation": "Son",    "initials": "MH", "role": "Caregiver", "phone": "(323) 555-0187", "phone_hours": "Mon-Fri, 5pm-9pm"},
    {"name": "Sofia Hernandez", "relation": "Daughter","initials": "SH","role": null,         "phone": "(323) 555-0163", "phone_hours": "Weekends"}
  ]'::jsonb
WHERE patient_id = 'p17';
