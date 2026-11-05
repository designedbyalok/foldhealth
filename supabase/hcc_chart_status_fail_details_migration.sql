-- ============================================================
-- hcc_chart_status: persist Fail reasons + comment
-- ============================================================
--
-- The three chart-fail surfaces (UploadChartDrawer, DiagPanel
-- DocumentsUploader, ChartDetailDrawer per-doc Fail action) each capture
-- { reasons: string[], note: string } when the reviewer marks a document
-- Failed. Before this migration only the `status` string ('Passed' |
-- 'Failed' | 'pending') was upserted to hcc_chart_status, so the pill
-- correctly persisted red but reopening the picker always showed empty
-- checkboxes: reasons only survived inside the activity log's jsonb
-- payload, not on the doc's own row.
--
-- Adds two nullable columns so setChartDocStatus can persist the full
-- fail state and fetchHccChartStatus can rehydrate the picker on reload.
-- Idempotent (`ADD COLUMN IF NOT EXISTS`), safe to re-run.

ALTER TABLE hcc_chart_status
  ADD COLUMN IF NOT EXISTS fail_reasons TEXT[],
  ADD COLUMN IF NOT EXISTS fail_note    TEXT;

-- ── Verify ────────────────────────────────────────────────────
--   select column_name, data_type from information_schema.columns
--    where table_name = 'hcc_chart_status'
--      and column_name in ('fail_reasons','fail_note')
--    order by column_name;
--   Expect 2 rows.
