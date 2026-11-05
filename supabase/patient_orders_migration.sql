-- Lab and imaging orders shown in the patient profile's Orders & Referrals
-- tab (Lab and Imaging views), placed from its New Lab Order / New Imaging
-- Order drawers.
CREATE TABLE IF NOT EXISTS patient_orders (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id  text NOT NULL,
  order_type  text NOT NULL CHECK (order_type IN ('lab', 'imaging')),
  name        text NOT NULL,
  reason      text,
  priority    text NOT NULL DEFAULT 'Routine',
  status      text NOT NULL DEFAULT 'Draft',
  ordered_by  text,
  due_date    date,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS patient_orders_patient_id_idx ON patient_orders (patient_id, created_at DESC);
ALTER TABLE patient_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on patient_orders" ON patient_orders;
-- Signed-in staff only; the public anon key gets nothing.
CREATE POLICY "Allow all on patient_orders" ON patient_orders FOR ALL TO authenticated USING ((select auth.uid()) is not null) WITH CHECK ((select auth.uid()) is not null);
