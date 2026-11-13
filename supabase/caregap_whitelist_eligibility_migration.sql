-- Who each whitelisted care gap applies to, so Add Care Gaps only offers
-- measures that fit the patient (no BCS for a male patient).
--
--   sex       'F' / 'M', or null for any
--   age_min   youngest age, as of Dec 31 of the measure year (null: no floor)
--   age_max   oldest age (null: no ceiling)
--
-- HEDIS denominators. Diagnosis-based ones (diabetes for EED, KED, GSD3,
-- SUPD) aren't modelled. Mirrors CAREGAP_WHITELIST_MOCK, which `bun run seed`
-- upserts with the same values. Idempotent.
--
-- Ask Alok Kumar to run this on Supabase.

begin;

alter table public.caregap_whitelist
  add column if not exists sex     text    check (sex in ('F', 'M')),
  add column if not exists age_min integer,
  add column if not exists age_max integer;

update public.caregap_whitelist w
set sex = d.sex, age_min = d.age_min, age_max = d.age_max
from (values
  ('CBP',    null, 18,   85),
  ('COL',    null, 45,   75),
  ('BCS',    'F',  40,   74),
  ('COA-FS', null, 66,   null),
  ('COA-M',  null, 66,   null),
  ('EED',    null, 18,   75),
  ('KED',    null, 18,   85),
  ('GSD3',   null, 18,   75),
  ('OMW',    'F',  67,   85),
  ('SUPD',   null, 40,   75),
  ('TRCMA',  null, 18,   null),
  ('DSF-A',  null, 12,   null)
) as d(code, sex, age_min, age_max)
where w.code = d.code;

commit;
