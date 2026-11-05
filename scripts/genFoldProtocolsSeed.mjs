// Writes supabase/fold_protocols_seed.sql from the Fold protocol content
// (src/features/settings/clinical-protocols/data/foldProtocolContent.js).
//
//   bun scripts/genFoldProtocolsSeed.mjs
//
// The seed is idempotent. It upserts each Fold protocol (Active, read-only,
// organization "Fold"); repoints templates adapted from the retired Fold
// Pathways to the matching protocol; and adds one published starter template
// per protocol unless a template already links to it. Starter templates name
// library items by title, resolved to ids in SQL so the same file works on
// any database. Run it after clinical_protocols_migration.sql and
// care_plan_template_source_protocol_migration.sql.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FOLD_PROTOCOL_CONTENT } from '../src/features/settings/clinical-protocols/data/foldProtocolContent.js';
import { foldProtocolRecord, foldStarterGbi } from '../src/features/settings/clinical-protocols/lib/foldProtocols.js';

const TAG = '$fold$';
const lit = (s) => {
  const text = String(s ?? '');
  if (text.includes(TAG)) throw new Error(`Content contains ${TAG}`);
  return `${TAG}${text}${TAG}`;
};
const json = (v) => `${lit(JSON.stringify(v))}::jsonb`;
const textArray = (list) => `ARRAY[${list.map(lit).join(', ')}]::text[]`;
const protocolId = (slug) => `md5(${lit(`fold-protocol:${slug}`)})::uuid`;
// Library titles match the way the app matches them: trimmed, case and runs of spaces ignored.
const titleKey = (expr) => `lower(regexp_replace(btrim(${expr}), '\\s+', ' ', 'g'))`;

const protocolValues = FOLD_PROTOCOL_CONTENT.map((entry) => {
  const r = foldProtocolRecord(entry);
  return `  (${protocolId(r.slug)}, ${lit(r.title)}, ${lit(r.organization)}, ${textArray(r.conditions)}, '{}', ${lit(r.author)}, ${lit(r.version)},
   'active', 'fold', 'Fold clinical content', ${json(r.protocol)}, ${json({ fold: { slug: r.slug } })}, 'Fold', 'Fold', now())`;
}).join(',\n');

// Session functions that turn a list of { title, priority?, goalTitle(s)? }
// into template entries linked to the library by title (trimmed, case and
// runs of spaces ignored), so a starter never invents a library item.
const resolver = (fn, table, alias, entryJson) => `CREATE FUNCTION pg_temp.${fn}(items jsonb) RETURNS jsonb LANGUAGE sql AS $fn$
  SELECT coalesce(jsonb_agg(jsonb_strip_nulls(${entryJson}) ORDER BY e.o), '[]'::jsonb)
  FROM jsonb_array_elements(coalesce(items, '[]'::jsonb)) WITH ORDINALITY AS e(j, o)
  LEFT JOIN LATERAL (SELECT * FROM public.${table} x WHERE ${titleKey('x.title')} = ${titleKey("e.j->>'title'")} ORDER BY x.created_at LIMIT 1) ${alias} ON true
$fn$;`;

const resolvers = [
  resolver('fold_goals', 'care_plan_goals', 'g', `jsonb_build_object(
    'id', g.id, 'title', coalesce(g.title, e.j->>'title'), 'subtitle', coalesce(g.description, ''),
    'category', coalesce(g.category, 'Other'), 'priority', coalesce(e.j->>'priority', g.priority, 'medium'))`),
  resolver('fold_interventions', 'care_plan_intervention_templates', 'i', `jsonb_build_object(
    'id', i.id, 'kind', coalesce(i.kind, e.j->>'kind', 'internal-task'), 'title', coalesce(i.title, e.j->>'title'),
    'config', coalesce(i.config, '{}'::jsonb) || jsonb_build_object('priority', coalesce(e.j->>'priority', i.config->>'priority', 'medium')),
    'goalTitle', e.j->'goalTitle')`),
  resolver('fold_barriers', 'care_plan_barriers', 'b', `jsonb_build_object(
    'id', b.id, 'title', coalesce(b.title, e.j->>'title'), 'description', coalesce(b.description, ''),
    'priority', coalesce(e.j->>'priority', 'medium'), 'goalTitles', e.j->'goalTitles')`),
  `CREATE FUNCTION pg_temp.fold_categories(cats jsonb) RETURNS jsonb LANGUAGE sql AS $fn$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', c->>'id', 'name', c->>'name', 'match', coalesce(c->>'match', 'all'), 'criteria', coalesce(c->'criteria', '[]'::jsonb),
    'goals', pg_temp.fold_goals(c->'goals'), 'interventions', pg_temp.fold_interventions(c->'interventions'),
    'barriers', pg_temp.fold_barriers(c->'barriers')) ORDER BY o), '[]'::jsonb)
  FROM jsonb_array_elements(coalesce(cats, '[]'::jsonb)) WITH ORDINALITY AS x(c, o)
$fn$;`,
].join('\n\n');

const srcOf = (entry) => {
  const r = foldProtocolRecord(entry);
  return `WITH src AS (
  SELECT ${protocolId(r.slug)} AS pid, ${lit(r.title)}::text AS name, ${lit(r.version)}::text AS version,
         ${textArray(r.conditions)} AS conditions, ${json(foldStarterGbi(entry))} AS gbi
)`;
};

const starter = (entry) => `${srcOf(entry)}
INSERT INTO public.care_plan_templates (name, conditions, goals, interventions, barriers, categories, status, scope, created_by, updated_by, source_protocol)
SELECT
  src.name, src.conditions,
  pg_temp.fold_goals(src.gbi->'goals'), pg_temp.fold_interventions(src.gbi->'interventions'), pg_temp.fold_barriers(src.gbi->'barriers'),
  pg_temp.fold_categories(src.gbi->'categories'),
  'published', 'org', 'Fold', 'Fold',
  jsonb_build_object('id', src.pid, 'title', src.name, 'version', src.version, 'organization', 'Fold')
FROM src
WHERE NOT EXISTS (SELECT 1 FROM public.care_plan_templates t WHERE t.source_protocol->>'id' = src.pid::text);`;

// A starter seeded before its content had categories takes them, as long as
// no patient has it yet: changing a template in use goes through a version.
const addCategories = (entry) => `${srcOf(entry)}
UPDATE public.care_plan_templates t SET
  goals = pg_temp.fold_goals(src.gbi->'goals'),
  interventions = pg_temp.fold_interventions(src.gbi->'interventions'),
  barriers = pg_temp.fold_barriers(src.gbi->'barriers'),
  categories = pg_temp.fold_categories(src.gbi->'categories'),
  updated_by = 'Fold', updated_at = now()
FROM src
WHERE t.created_by = 'Fold'
  AND t.source_protocol->>'id' = src.pid::text
  AND t.categories = '[]'::jsonb
  AND NOT EXISTS (SELECT 1 FROM public.patient_care_plan_template_instances i WHERE i.template_id = t.id);`;

const sql = `-- Generated by scripts/genFoldProtocolsSeed.mjs from
-- src/features/settings/clinical-protocols/data/foldProtocolContent.js. Do not edit by hand.
--
-- Fold's clinical protocols, which replace the Fold Pathway Library: each
-- pathway's decision logic, cadence and sources become an Active, read-only
-- clinical protocol (organization "Fold", source_kind 'fold'), and its goals,
-- interventions and barriers a published starter template linked to it.
-- Idempotent: protocols are upserted by a fixed id; a starter template is only
-- added when no template links to its protocol yet, and a starter no patient
-- uses yet takes its categories (Common + per-patient groups, see
-- care_plan_template_categories_migration.sql). The care_pathways table is
-- left in place but no longer read.

BEGIN;

ALTER TABLE public.care_plan_templates
  ADD COLUMN IF NOT EXISTS categories jsonb NOT NULL DEFAULT '[]'::jsonb;

${resolvers}

-- Fold protocols are their own source kind.
ALTER TABLE public.clinical_protocols DROP CONSTRAINT IF EXISTS clinical_protocols_source_kind_check;
ALTER TABLE public.clinical_protocols ADD CONSTRAINT clinical_protocols_source_kind_check
  CHECK (source_kind IS NULL OR source_kind IN ('pdf', 'docx', 'json', 'fold'));

INSERT INTO public.clinical_protocols
  (id, title, organization, condition_tags, program_codes, author, version,
   status, source_kind, source_name, protocol, parse_meta, uploaded_by, approved_by, approved_at)
VALUES
${protocolValues}
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  organization = EXCLUDED.organization,
  condition_tags = EXCLUDED.condition_tags,
  author = EXCLUDED.author,
  version = EXCLUDED.version,
  source_kind = EXCLUDED.source_kind,
  source_name = EXCLUDED.source_name,
  protocol = EXCLUDED.protocol,
  parse_meta = EXCLUDED.parse_meta,
  updated_at = CASE
    WHEN (clinical_protocols.title, clinical_protocols.version, clinical_protocols.protocol)
      IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.version, EXCLUDED.protocol)
    THEN now() ELSE clinical_protocols.updated_at END;

-- Templates adapted from a Fold pathway now point at its protocol, keeping
-- the version they came from so a newer protocol shows as an update.
UPDATE public.care_plan_templates t
SET source_protocol = jsonb_build_object(
  'id', p.id, 'title', p.title, 'version', coalesce(t.source_pathway->>'version', p.version), 'organization', 'Fold')
FROM public.clinical_protocols p
WHERE t.source_protocol IS NULL
  AND t.source_pathway ? 'id'
  AND p.id = md5('fold-protocol:' || (t.source_pathway->>'id'))::uuid;

-- One starter template per Fold protocol.
${FOLD_PROTOCOL_CONTENT.map(starter).join('\n\n')}

-- Categories for starters seeded before their content had them.
${FOLD_PROTOCOL_CONTENT.filter(e => e.categories?.length).map(addCategories).join('\n\n')}

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ── Rollback ────────────────────────────────────────────────────────────────
-- DELETE FROM public.care_plan_templates WHERE created_by = 'Fold' AND source_protocol->>'organization' = 'Fold';
-- UPDATE public.care_plan_templates SET source_protocol = NULL WHERE source_pathway IS NOT NULL AND source_protocol->>'organization' = 'Fold';
-- DELETE FROM public.clinical_protocols WHERE source_kind = 'fold';
`;

const out = fileURLToPath(new URL('../supabase/fold_protocols_seed.sql', import.meta.url));
writeFileSync(out, sql);
console.log(`Wrote ${FOLD_PROTOCOL_CONTENT.length} Fold protocols and starter templates to supabase/fold_protocols_seed.sql`);
