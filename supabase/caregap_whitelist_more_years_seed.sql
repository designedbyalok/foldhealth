-- Care gap whitelist for measure years 2024 and 2027.
--
-- Add Care Gaps offers the current year, the two before it, and the next
-- year from October. 2024 copies the 2025 list and 2027 copies the 2026
-- list. Idempotent. Mirrors CAREGAP_WHITELIST_MOCK (`bun run seed` upserts
-- the same rows).
--
-- Ask Alok Kumar to run this on Supabase.

begin;

insert into public.caregap_whitelist (id, code, name, measure_year, ipas, hp_codes, billable, active)
select code || '-MY' || y.to_year, code, name, y.to_year, ipas, hp_codes, billable, active
from public.caregap_whitelist w
join (values (2025, 2024), (2026, 2027)) as y(from_year, to_year)
  on w.measure_year = y.from_year
on conflict (id) do nothing;

commit;
