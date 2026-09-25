import { supabase } from '../../lib/supabase';
import { reportPersistFailure } from './reportPersistFailure';

// Supabase I/O for `efax_numbers` (supabase/efax_numbers_migration.sql).

const MISSING_TABLE_RE = /efax_numbers|does not exist|schema cache/i;

export function rowToEfaxNumber(r) {
  return {
    id: r.id,
    name: r.name || '',
    number: r.number || '',
    linkedUserIds: Array.isArray(r.linked_user_ids) ? r.linked_user_ids : [],
    isActive: r.is_active !== false,
    updatedBy: r.updated_by || '',
    updatedAt: r.updated_at || null,
  };
}

function patchToRow(patch) {
  const row = {};
  if ('name' in patch) row.name = patch.name;
  if ('number' in patch) row.number = patch.number;
  if ('linkedUserIds' in patch) row.linked_user_ids = patch.linkedUserIds || [];
  if ('isActive' in patch) row.is_active = !!patch.isActive;
  if ('updatedBy' in patch) row.updated_by = patch.updatedBy || null;
  return row;
}

/** @returns {Promise<{ rows: object[], missing: boolean }>} */
export async function fetchEfaxNumberRows() {
  const { data, error } = await supabase.from('efax_numbers').select('*').order('name');
  if (error) {
    const missing = MISSING_TABLE_RE.test(error.message || '');
    if (!missing) console.warn('fetchEfaxNumbers failed:', error.message);
    return { rows: [], missing };
  }
  return { rows: (data || []).map(rowToEfaxNumber), missing: false };
}

/** @returns {Promise<{ missing: boolean }>} */
export async function persistEfaxNumberInsert(n) {
  const { error } = await supabase.from('efax_numbers').insert({
    id: n.id, ...patchToRow(n), created_by: n.updatedBy || null,
  });
  if (!error) return { missing: false };
  if (MISSING_TABLE_RE.test(error.message || '')) return { missing: true };
  reportPersistFailure(`persistEfaxNumberInsert(${n.id})`, error);
  return { missing: false };
}

export function persistEfaxNumberUpdate(id, patch) {
  const row = patchToRow(patch || {});
  if (!id || !Object.keys(row).length) return;
  supabase.from('efax_numbers').update({ ...row, updated_at: new Date().toISOString() }).eq('id', id)
    .then(({ error }) => { if (error) reportPersistFailure(`persistEfaxNumberUpdate(${id})`, error); });
}

export function persistEfaxNumberDelete(id) {
  if (!id) return;
  supabase.from('efax_numbers').delete().eq('id', id)
    .then(({ error }) => { if (error) reportPersistFailure(`persistEfaxNumberDelete(${id})`, error); });
}
