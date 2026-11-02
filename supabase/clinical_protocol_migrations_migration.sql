-- Clinical protocol version migrations. When a new version of a protocol is
-- approved (Settings > Care Plan Library > Clinical Protocols), the
-- supervisor sees every active care plan run that follows an earlier version
-- of it, broken down by cohort, and picks how they move:
--
--   all     every affected run moves to the new version now
--   cohort  the runs in the chosen cohorts move now; the rest stay
--   review  each run moves when its plan's next review is completed
--
-- A run follows a protocol directly (protocol_id, set once it has been
-- migrated) or, until then, through its template's source_protocol
-- (care_plan_template_source_protocol_migration.sql).
--
--   clinical_protocol_migrations  one row per decision: who, when, mode,
--                                 cohort, from/to version and the counts.
--   patient_care_plan_template_instances.protocol_*  the protocol version
--                                 a run follows, and the one it waits on.
-- Each run that moves also writes a care_plan_audit row (entity_type
-- 'protocol'), which is the per-plan trail.
--
-- Additive and idempotent.

CREATE TABLE IF NOT EXISTS public.clinical_protocol_migrations (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id        uuid NOT NULL REFERENCES public.clinical_protocols(id) ON DELETE CASCADE,
  from_protocol_id   uuid REFERENCES public.clinical_protocols(id) ON DELETE SET NULL,
  from_version       text,
  to_version         text,
  mode               text NOT NULL CHECK (mode IN ('all', 'cohort', 'review')),
  -- { programCode: [...], ipa: [...], careManager: [...], groups: [...] } for 'cohort'.
  cohort             jsonb,
  affected           integer NOT NULL DEFAULT 0,
  migrated           integer NOT NULL DEFAULT 0,
  deferred           integer NOT NULL DEFAULT 0,
  failed             integer NOT NULL DEFAULT 0,
  actor              text,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clinical_protocol_migrations_protocol_idx ON public.clinical_protocol_migrations (protocol_id, created_at DESC);

ALTER TABLE public.clinical_protocol_migrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Signed-in staff on clinical_protocol_migrations" ON public.clinical_protocol_migrations;
CREATE POLICY "Signed-in staff on clinical_protocol_migrations" ON public.clinical_protocol_migrations
  FOR ALL TO authenticated
  USING ((select auth.uid()) is not null)
  WITH CHECK ((select auth.uid()) is not null);

ALTER TABLE public.patient_care_plan_template_instances
  ADD COLUMN IF NOT EXISTS protocol_id          uuid REFERENCES public.clinical_protocols(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS protocol_version     text,
  ADD COLUMN IF NOT EXISTS pending_protocol_id  uuid REFERENCES public.clinical_protocols(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pending_protocol_migration_id uuid REFERENCES public.clinical_protocol_migrations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS pcp_template_instances_protocol_idx ON public.patient_care_plan_template_instances (protocol_id);
CREATE INDEX IF NOT EXISTS pcp_template_instances_pending_protocol_idx ON public.patient_care_plan_template_instances (pending_protocol_id);

NOTIFY pgrst, 'reload schema';

-- ── Rollback ────────────────────────────────────────────────────────────────
-- ALTER TABLE public.patient_care_plan_template_instances
--   DROP COLUMN IF EXISTS pending_protocol_migration_id, DROP COLUMN IF EXISTS pending_protocol_id,
--   DROP COLUMN IF EXISTS protocol_version, DROP COLUMN IF EXISTS protocol_id;
-- DROP TABLE IF EXISTS public.clinical_protocol_migrations;
