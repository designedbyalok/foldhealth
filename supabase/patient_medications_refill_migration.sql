-- When a medication was last filled and how many days that fill covers, so
-- the Overview's Medications card can say a refill is due (or has run out).
-- Both are optional; a medication without them is never flagged for refill.

ALTER TABLE public.patient_medications
  ADD COLUMN IF NOT EXISTS last_filled_on date,
  ADD COLUMN IF NOT EXISTS days_supply    integer CHECK (days_supply IS NULL OR days_supply > 0);

-- ── Demo seed ─────────────────────────────────────────────────────────────
-- Annette Brave (patient 11089): her Povidone-Iodine fill from 09/28/2026
-- covers 30 days, so the Overview shows its refill as due.
UPDATE public.patient_medications
   SET last_filled_on = '2026-09-28', days_supply = 30
 WHERE patient_id = '11089' AND name = 'Povidone-Iodine .1 mg/mL' AND last_filled_on IS NULL;

-- ── Verify ────────────────────────────────────────────────────────────────
--   select column_name from information_schema.columns
--    where table_name = 'patient_medications' and column_name in ('last_filled_on','days_supply');
--   Expect both.

-- ── Rollback ──────────────────────────────────────────────────────────────
--   alter table public.patient_medications drop column if exists last_filled_on;
--   alter table public.patient_medications drop column if exists days_supply;
