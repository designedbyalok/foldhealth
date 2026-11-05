-- Adds Visit Type to hcc_added_charts so an uploaded doc's encounter category
-- (AWV, IPPE, Annual Physical, Telehealth Visit, ER Visit, TCM, CCM, …)
-- survives reload.
--
-- Every HCC upload surface: UploadChartDrawer, the DiagPanel inline
-- DocumentsUploader, and the ChartDetailDrawer right-pane upload, captures
-- Visit Type via a <Select> populated from reference/visitTypes.js and
-- threads it through makeUploadedChartDoc → doc.vt. updateChartDocMeta writes
-- patch.vt to visit_type when the DB column is present; without this column
-- the Visit Type edit only lives in local state and gets dropped on refresh.
--
-- Idempotent (ADD COLUMN IF NOT EXISTS), safe to re-run.

ALTER TABLE hcc_added_charts
  ADD COLUMN IF NOT EXISTS visit_type TEXT;

-- ── Verify ────────────────────────────────────────────────────────────────
--   select column_name from information_schema.columns
--    where table_name = 'hcc_added_charts' and column_name = 'visit_type';
--   Expect one row.

-- ── Rollback ──────────────────────────────────────────────────────────────
--   alter table hcc_added_charts drop column if exists visit_type;
