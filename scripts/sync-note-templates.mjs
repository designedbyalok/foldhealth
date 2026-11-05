/**
 * Sync the Note Template field schemas from JS → `public.forms.schema`.
 *
 * `GAP_TEMPLATES` in
 * `src/features/hedis-worklist/ClinicalNotePanel.utils.js` is the
 * canonical, hand-written source for every HEDIS Care Gap Note
 * Template's field descriptors. Until P2-1 no schema had ever been
 * persisted: `forms` rows held only name + description. This script
 * upserts each gap's field schema into the matching `forms` row so the
 * app can eventually read templates from the DB (and Settings →
 * Content → Notes can render them for edit).
 *
 * Behavior:
 *   • For each key in GAP_TEMPLATES:
 *     - find (or create) a `forms` row where gap_code = key AND
 *       form_type = 'Note';
 *     - stamp `schema = { items: <GAP_TEMPLATES[key]> }` so the
 *       existing forms builder shape is preserved;
 *     - set is_default_for_gap = true, category = 'Care Gap',
 *       status = 'active', field_kind = 'note'.
 *   • Rows outside GAP_TEMPLATES (e.g. Consolidated Clinical Note)
 *     are untouched.
 *   • The pump is idempotent: the same JS input produces the same
 *     JSONB output every run.
 *
 * Run:
 *   SUPABASE_SERVICE_ROLE_KEY=... bun scripts/sync-note-templates.mjs
 *
 * Depends on `supabase/note_templates_migration.sql` having landed.
 */
import { createClient } from '@supabase/supabase-js';
import { GAP_TEMPLATES } from '../src/features/hedis-worklist/ClinicalNotePanel.utils.js';

const PROJECT_REF = 'osnihfqqrcchsaqhagcx';
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function upsertTemplate(gapCode, fields) {
  const name = `${gapCode} Visit Note`;
  const schema = { items: fields };

  // Prefer an existing row with the exact gap_code; fall back to matching
  // by name so the very first run (before the migration's regexp backfill
  // finished for legacy names) still lands on the right row.
  const { data: existing, error: selectErr } = await supabase
    .from('forms')
    .select('id, name, gap_code, form_type')
    .or(`gap_code.eq.${gapCode},name.eq.${name}`)
    .eq('form_type', 'Note')
    .maybeSingle();
  if (selectErr && selectErr.code !== 'PGRST116') {
    console.error(`  ${gapCode}: select failed -`, selectErr.message);
    return { code: gapCode, status: 'error' };
  }

  const payload = {
    name,
    gap_code: gapCode,
    form_type: 'Note',
    category: 'Care Gap',
    status: 'active',
    is_default_for_gap: true,
    schema,
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { error } = await supabase.from('forms').update(payload).eq('id', existing.id);
    if (error) {
      console.error(`  ${gapCode}: update failed -`, error.message);
      return { code: gapCode, status: 'error' };
    }
    console.log(`  ✓ ${gapCode}: updated (id ${existing.id}, ${fields.length} fields)`);
    return { code: gapCode, status: 'updated', id: existing.id };
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('forms')
    .insert(payload)
    .select('id')
    .single();
  if (insertErr) {
    console.error(`  ${gapCode}: insert failed -`, insertErr.message);
    return { code: gapCode, status: 'error' };
  }
  console.log(`  ✓ ${gapCode}: inserted (id ${inserted.id}, ${fields.length} fields)`);
  return { code: gapCode, status: 'inserted', id: inserted.id };
}

async function main() {
  const entries = Object.entries(GAP_TEMPLATES);
  console.log(`Syncing ${entries.length} Note Template schemas → public.forms…`);
  let ok = 0;
  let err = 0;
  for (const [gapCode, fields] of entries) {
    const result = await upsertTemplate(gapCode, fields);
    if (result.status === 'error') err += 1; else ok += 1;
  }
  console.log(`\nDone. ${ok} ok, ${err} errored.`);
  if (err > 0) process.exit(1);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
