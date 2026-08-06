-- ============================================================
-- Agents — add `model`, `role`, `avatar_url` columns
-- ============================================================
--
-- Drives the new AgentsTable columns (Model, and Agent Name's role
-- subtitle + avatar). Idempotent — safe to re-run.
--
-- `model` is the LLM identifier shown in the Model column (e.g.
-- "ChatGPT 4.5 Mini", "Claude Opus 4.7"). It's the routing key the
-- runtime will use to call the underlying provider (see the agent-runtime
-- design note in the review at the bottom of this batch).
--
-- `role` is the human-readable persona label rendered under the agent
-- name in the primary identity cell (e.g. "Front Desk Coordinator",
-- "Care Navigator"). Optional — the UI hides the subtitle when null.
--
-- `avatar_url` is a hosted image URL for the agent's identity chip.
-- When null the UI falls back to an Avatar with the agent's initials.

ALTER TABLE agents ADD COLUMN IF NOT EXISTS model      TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS role       TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Backfill sensible defaults for the eight seeded agents so the table
-- reads as populated on first paint. New rows can set these explicitly
-- via the builder's Configure panel.
UPDATE agents SET model = 'ChatGPT 4.5 Mini', role = 'Post-Discharge Coordinator'      WHERE id = 'a1' AND model IS NULL;
UPDATE agents SET model = 'ChatGPT 4.5 Mini', role = 'Geriatric Care Navigator'        WHERE id = 'a2' AND model IS NULL;
UPDATE agents SET model = 'Claude Opus 4.7', role = 'Hypertension Coach'               WHERE id = 'a3' AND model IS NULL;
UPDATE agents SET model = 'Claude Sonnet 5', role = 'Remote Patient Monitor'           WHERE id = 'a4' AND model IS NULL;
UPDATE agents SET model = 'ChatGPT 4.5 Mini', role = 'Mental Health Companion'         WHERE id = 'a5' AND model IS NULL;
UPDATE agents SET model = 'Claude Sonnet 5', role = 'Retinopathy Screening Coordinator' WHERE id = 'a6' AND model IS NULL;
UPDATE agents SET model = 'Claude Opus 4.7', role = 'COPD Care Coordinator'            WHERE id = 'a7' AND model IS NULL;
UPDATE agents SET model = 'ChatGPT 4.5 Mini', role = 'Post-Surgery Rehab Guide'        WHERE id = 'a8' AND model IS NULL;
