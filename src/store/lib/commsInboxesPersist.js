import { supabase } from '../../lib/supabase';
import { reportPersistFailure } from './reportPersistFailure';

// Supabase I/O for `comms_inboxes` (supabase/comms_inboxes_migration.sql).

const MISSING_TABLE_RE = /comms_inboxes|does not exist|schema cache/i;

export function rowToInbox(r) {
  return {
    id: r.id,
    channel: r.channel || 'sms',
    name: r.name || '',
    address: r.address || '',
    collaboratorIds: Array.isArray(r.collaborator_ids) ? r.collaborator_ids : [],
    updatedBy: r.updated_by || '',
    updatedAt: r.updated_at || null,
  };
}

function patchToRow(patch) {
  const row = {};
  if ('channel' in patch) row.channel = patch.channel;
  if ('name' in patch) row.name = patch.name;
  if ('address' in patch) row.address = patch.address;
  if ('collaboratorIds' in patch) row.collaborator_ids = patch.collaboratorIds || [];
  if ('updatedBy' in patch) row.updated_by = patch.updatedBy || null;
  return row;
}

/** @returns {Promise<{ rows: object[], missing: boolean }>} */
export async function fetchInboxRows() {
  const { data, error } = await supabase.from('comms_inboxes').select('*').order('name');
  if (error) {
    const missing = MISSING_TABLE_RE.test(error.message || '');
    if (!missing) console.warn('fetchCommsInboxes failed:', error.message);
    return { rows: [], missing };
  }
  return { rows: (data || []).map(rowToInbox), missing: false };
}

/** @returns {Promise<{ missing: boolean }>} */
export async function persistInboxInsert(i) {
  const { error } = await supabase.from('comms_inboxes').insert({ id: i.id, ...patchToRow(i), created_by: i.updatedBy || null });
  if (!error) return { missing: false };
  if (MISSING_TABLE_RE.test(error.message || '')) return { missing: true };
  reportPersistFailure(`persistInboxInsert(${i.id})`, error);
  return { missing: false };
}

export function persistInboxUpdate(id, patch) {
  const row = patchToRow(patch || {});
  if (!id || !Object.keys(row).length) return;
  supabase.from('comms_inboxes').update({ ...row, updated_at: new Date().toISOString() }).eq('id', id)
    .then(({ error }) => { if (error) reportPersistFailure(`persistInboxUpdate(${id})`, error); });
}

export function persistInboxDelete(id) {
  if (!id) return;
  supabase.from('comms_inboxes').delete().eq('id', id)
    .then(({ error }) => { if (error) reportPersistFailure(`persistInboxDelete(${id})`, error); });
}
