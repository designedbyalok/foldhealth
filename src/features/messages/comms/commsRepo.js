// Patient comms data: conversations and their messages, on any channel.
//
// Reads and writes Supabase (patient_conversations / patient_messages) with
// realtime. If those tables don't exist yet (migration not run), it keeps the
// same data in localStorage instead and syncs open tabs through the `storage`
// event, so a staff tab and the patient's page still talk to each other on
// one machine. Nothing is seeded: every conversation is a real one.

import { supabase } from '../../../lib/supabase';
import { EDUCATION_LIBRARY } from './educationLibrary';

// v2: v1 held seeded sample conversations; only real ones are kept now.
const LOCAL_KEY = 'fold-comms-v2';
const emitter = new EventTarget();

let modePromise = null;
/** 'remote' when the Supabase tables answer, otherwise 'local'. */
export function commsMode() {
  if (!modePromise) {
    modePromise = supabase.from('patient_conversations').select('id').limit(1)
      .then(({ error }) => (error ? 'local' : 'remote'))
      .catch(() => 'local');
  }
  return modePromise;
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const now = () => new Date().toISOString();

export const newPatientToken = () => uid().replace(/-/g, '').slice(0, 20);

const CONV_DEFAULTS = {
  patient_id: null, patient_name: '', patient_email: null, patient_phone: null, group_name: null,
  subject: null, patient_token: null, assigned_to: null, sticky_note: null, members: [], starred: false, archived: false, pinned: false,
  unread_count: 0, last_preview: '', created_by: null, created_by_name: null,
};
const MSG_DEFAULTS = {
  kind: 'message', direction: 'out', internal: false, sender_id: null, sender_name: '', body: '', html: null,
  subject: null, from_addr: null, to_addr: null, cc: null, bcc: null, status: 'sent', failure_reason: null,
  provider_id: null, meta: {}, read_at: null,
};

// ── Local backend ─────────────────────────────────────────────────────────
// Messages are patient data, so outside dev builds the fallback lives in
// memory only and is gone when the tab closes (a failed mode check in
// production must not leave PHI on a shared machine's disk).
const PERSIST_LOCAL = import.meta.env.DEV;
let memoryDb = { conversations: [], messages: [] };

function readLocal() {
  if (!PERSIST_LOCAL) return memoryDb;
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* storage blocked: start empty */ }
  return { conversations: [], messages: [] };
}

try {
  localStorage.removeItem('fold-comms-v1');
  if (!PERSIST_LOCAL) localStorage.removeItem(LOCAL_KEY);
} catch { /* storage blocked */ }

// Own writes are announced in this tab right away; realtime echoes of them
// (remote mode) carry the same id, so listeners upsert by id.
function emit(change) {
  emitter.dispatchEvent(new CustomEvent('change', { detail: change }));
}

function writeLocal(db, change) {
  if (!PERSIST_LOCAL) {
    memoryDb = db;
  } else {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(db)); } catch { /* quota or blocked */ }
  }
  if (change) emit(change);
}

if (typeof window !== 'undefined') {
  // Another tab wrote: tell this tab's listeners to reload.
  window.addEventListener('storage', (e) => {
    if (e.key === LOCAL_KEY) emitter.dispatchEvent(new CustomEvent('change', { detail: { table: '*', type: 'reload' } }));
  });
}

// ── Public API ────────────────────────────────────────────────────────────
// One conversation's row (sending a message only needs its unread count, not
// every conversation in the practice).
async function getConversation(id) {
  if (await commsMode() === 'local') return readLocal().conversations.find(c => c.id === id) || null;
  const { data } = await supabase.from('patient_conversations').select('*').eq('id', id).maybeSingle();
  return data || null;
}

export async function listConversations() {
  if (await commsMode() === 'local') {
    return [...readLocal().conversations].sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
  }
  const { data, error } = await supabase.from('patient_conversations').select('*').order('last_message_at', { ascending: false });
  if (error) throw error;
  return withSavedThreadNames(data || []);
}

/**
 * One patient's conversations (by patient id, or by name for threads that
 * carry no id), newest first. A one-off read for patient surfaces, so they
 * don't load every conversation.
 */
export async function listPatientConversations({ patientId, patientName }) {
  const id = patientId != null ? String(patientId) : null;
  if (!id && !patientName) return [];
  const matches = c => (id && c.patient_id === id) || (!c.patient_id && patientName && c.patient_name === patientName);
  if (await commsMode() === 'local') {
    return readLocal().conversations.filter(matches)
      .sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
  }
  let query = supabase.from('patient_conversations').select('*').order('last_message_at', { ascending: false });
  if (id && patientName) query = query.or(`patient_id.eq.${id},and(patient_id.is.null,patient_name.eq."${patientName.replace(/"/g, '')}")`);
  else if (id) query = query.eq('patient_id', id);
  else query = query.is('patient_id', null).eq('patient_name', patientName);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function listMessages(conversationId) {
  if (await commsMode() === 'local') {
    return readLocal().messages.filter(m => m.conversation_id === conversationId)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }
  const { data, error } = await supabase.from('patient_messages').select('*')
    .eq('conversation_id', conversationId).order('created_at', { ascending: true });
  if (error) throw error;
  return withSessionAttribution(data || []);
}

/** Messages across several conversations (e.g. every email thread). */
export async function listMessagesFor(conversationIds) {
  if (!conversationIds.length) return [];
  if (await commsMode() === 'local') {
    const ids = new Set(conversationIds);
    return readLocal().messages.filter(m => ids.has(m.conversation_id));
  }
  const { data, error } = await supabase.from('patient_messages').select('*').in('conversation_id', conversationIds);
  if (error) throw error;
  return withSessionAttribution(data || []);
}

export async function createConversation(fields) {
  const row = { ...CONV_DEFAULTS, id: uid(), created_at: now(), last_message_at: now(), ...fields };
  if (await commsMode() === 'local') {
    const db = readLocal();
    db.conversations.push(row);
    writeLocal(db, { table: 'patient_conversations', type: 'INSERT', row });
    return row;
  }
  const { data, error } = await supabase.from('patient_conversations').insert(row).select().single();
  if (error) throw error;
  emit({ table: 'patient_conversations', type: 'INSERT', row: data });
  return data;
}

export async function updateConversation(id, patch) {
  if (await commsMode() === 'local') {
    const db = readLocal();
    const i = db.conversations.findIndex(c => c.id === id);
    if (i < 0) return null;
    db.conversations[i] = { ...db.conversations[i], ...patch };
    writeLocal(db, { table: 'patient_conversations', type: 'UPDATE', row: db.conversations[i] });
    return db.conversations[i];
  }
  const { data, error } = await supabase.from('patient_conversations').update(patch).eq('id', id).select().single();
  if (error) throw error;
  emit({ table: 'patient_conversations', type: 'UPDATE', row: data });
  return data;
}

/**
 * Find the patient's conversation on a channel, or open one. An SMS thread
 * belongs to the phone number (FCS-5677: a shared number keeps one thread),
 * so it's found by number first; whoever sends, it's the same thread.
 */
export async function findOrCreateConversation(channel, patient, extra = {}) {
  const key = patient.id != null ? String(patient.id) : null;
  const phone10 = String(extra.patient_phone || patient.phone || '').replace(/\D/g, '').slice(-10);
  let found;
  if (channel === 'sms' && phone10.length === 10) {
    if (await commsMode() === 'remote') {
      const { data } = await supabase.from('patient_conversations').select('*').eq('channel', 'sms')
        .like('patient_phone', `%${phone10}`)
        .order('last_message_at', { ascending: false }).limit(1);
      found = data?.[0];
    } else {
      found = readLocal().conversations
        .filter(c => c.channel === 'sms' && String(c.patient_phone || '').replace(/\D/g, '').slice(-10) === phone10)
        .sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at))[0];
    }
    if (found) return found;
  }
  if (await commsMode() === 'remote') {
    const { data } = await supabase.from('patient_conversations').select('*').eq('channel', channel)
      .eq(key ? 'patient_id' : 'patient_name', key || patient.name || '')
      .order('last_message_at', { ascending: false }).limit(1);
    found = data?.[0];
  } else {
    found = readLocal().conversations.find(c => c.channel === channel && (
      (key && c.patient_id === key) || (!key && c.patient_name === patient.name)
    ));
  }
  if (found) return found;
  return createConversation({
    channel,
    patient_id: key,
    patient_name: patient.name || '',
    patient_email: patient.email || null,
    patient_phone: patient.phone || null,
    ...(channel === 'chat' || channel === 'sms' ? { patient_token: newPatientToken() } : {}),
    ...extra,
  });
}

function previewOf(m) {
  if (m.kind === 'call') return m.body || 'Call';
  if (m.kind === 'email') return m.subject || m.body || '';
  return (m.body || (m.meta?.attachment ? 'Sent an attachment' : '')).replace(/\s+/g, ' ').slice(0, 140);
}

/**
 * Add a message, and bring its conversation's preview, time and unread
 * count along. Drafts and internal notes don't move the preview.
 */
export async function addMessage(fields) {
  const row = { ...MSG_DEFAULTS, id: uid(), created_at: now(), ...fields };
  let saved;
  if (await commsMode() === 'local') {
    const db = readLocal();
    if (row.provider_id && db.messages.some(m => m.provider_id === row.provider_id)) return null;
    db.messages.push(row);
    writeLocal(db, { table: 'patient_messages', type: 'INSERT', row });
    saved = row;
  } else {
    let { data, error } = await supabase.from('patient_messages').insert(row).select().single();
    if (error && isMissingColumn(error) && ATTRIBUTION_FIELDS.some(f => f in row)) {
      ({ data, error } = await supabase.from('patient_messages').insert(withoutAttribution(row)).select().single());
      if (data) data = rememberAttribution(data, row);
    }
    if (error) {
      if (error.code === '23505') return null; // this provider message is already in
      throw error;
    }
    saved = data;
    emit({ table: 'patient_messages', type: 'INSERT', row: data });
  }
  if (saved.status !== 'draft' && !saved.internal) {
    const c = await getConversation(saved.conversation_id);
    await updateConversation(saved.conversation_id, {
      last_preview: previewOf(saved),
      last_message_at: saved.created_at,
      archived: false,
      ...(saved.direction === 'in' ? { unread_count: (c?.unread_count || 0) + 1 } : {}),
    });
  }
  return saved;
}

// Who an SMS is logged for (supabase/sms_member_attribution_migration.sql).
// Until those columns exist a message is saved without them and belongs to
// its conversation's patient.
const ATTRIBUTION_FIELDS = ['logged_for_patient_id', 'logged_for_name'];
const MISSING_SCHEMA = new Set(['42P01', 'PGRST205', '42703', 'PGRST204']);
const isMissingColumn = (error) => MISSING_SCHEMA.has(error?.code);
function withoutAttribution(row) {
  const rest = { ...row };
  ATTRIBUTION_FIELDS.forEach(f => delete rest[f]);
  return rest;
}

// Until the migration runs, who a message is logged for is kept in this
// browser (it survives a reload), so the flow can still be tried end to end.
const ATTRIBUTION_KEY = 'fold-sms-attribution';
const sessionAttribution = new Map((() => {
  try { return Object.entries(JSON.parse(localStorage.getItem(ATTRIBUTION_KEY) || '{}')); } catch { return []; }
})());
function rememberAttribution(saved, source) {
  const attr = Object.fromEntries(ATTRIBUTION_FIELDS.map(f => [f, source[f] ?? null]));
  sessionAttribution.set(saved.id, attr);
  try { localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(Object.fromEntries(sessionAttribution))); } catch { /* storage blocked: this session only */ }
  return { ...saved, ...attr };
}
function withSessionAttribution(rows) {
  return sessionAttribution.size
    ? rows.map(r => (sessionAttribution.has(r.id) ? { ...r, ...sessionAttribution.get(r.id) } : r))
    : rows;
}

/** Log these messages for one member of a shared number. */
export async function logMessagesFor(ids, member) {
  if (!ids.length) return;
  const patch = { logged_for_patient_id: member.id, logged_for_name: member.name };
  if (await commsMode() === 'local') {
    await Promise.all(ids.map(id => updateMessage(id, patch)));
    return;
  }
  const { data, error } = await supabase.from('patient_messages').update(patch).in('id', ids).select();
  if (error && isMissingColumn(error)) {
    const { data: rows, error: readError } = await supabase.from('patient_messages').select('*').in('id', ids);
    if (readError) throw new Error(readError.message);
    for (const row of rows || []) emit({ table: 'patient_messages', type: 'UPDATE', row: rememberAttribution(row, patch) });
    return;
  }
  if (error) throw new Error(error.message);
  for (const row of data || []) emit({ table: 'patient_messages', type: 'UPDATE', row });
}

/**
 * Assign received SMS to a member, noting how (`by`: 'staff' by hand, or
 * 'session' by a rest-of-today session), so "all messages below" can stop
 * at the next one someone assigned by hand.
 */
export async function assignMessages(messages, member, by) {
  if (!messages.length) return;
  await logMessagesFor(messages.map(m => m.id), member);
  await Promise.all(messages.map(m => updateMessage(m.id, { meta: { ...(m.meta || {}), assigned_by: by } })));
}

/**
 * Every SMS logged for a patient, newest first, each with its conversation:
 * the ones logged for them on any number, and the ones in their own SMS
 * threads that name no one. `isShared(conversation)` marks shared numbers,
 * where a received SMS naming no one is Unassigned and belongs to nobody.
 */
export async function listSmsLoggedFor({ patientId, patientName, isShared = () => false }) {
  const id = patientId != null ? String(patientId) : null;
  const own = (await listPatientConversations({ patientId, patientName })).filter(c => c.channel === 'sms');
  const ownIds = new Set(own.map(c => c.id));
  let messages;
  if (await commsMode() === 'local') {
    messages = readLocal().messages.filter(m => (id && m.logged_for_patient_id === id)
      || (ownIds.has(m.conversation_id) && !m.logged_for_patient_id));
  } else {
    const inOwn = await listMessagesFor([...ownIds]);
    let elsewhere = [];
    if (id) {
      const { data, error } = await supabase.from('patient_messages').select('*').eq('logged_for_patient_id', id);
      if (error && !isMissingColumn(error)) throw error;
      elsewhere = data || [];
      // Before the columns exist, this browser remembers who each SMS was logged for.
      if (error) {
        const ids = [...sessionAttribution].filter(([, a]) => a.logged_for_patient_id === id).map(([mid]) => mid);
        if (ids.length) {
          const { data: rows } = await supabase.from('patient_messages').select('*').in('id', ids);
          elsewhere = withSessionAttribution(rows || []);
        }
      }
    }
    const seen = new Set();
    messages = [...elsewhere, ...inOwn.filter(m => !m.logged_for_patient_id || m.logged_for_patient_id === id)]
      .filter(m => !seen.has(m.id) && seen.add(m.id));
  }
  // Only texts that went out (or came in): a draft or a failed send isn't activity.
  messages = messages.filter(m => m.kind === 'message' && !m.internal && m.status !== 'draft' && m.status !== 'failed');
  const convs = new Map(own.map(c => [c.id, c]));
  const missing = [...new Set(messages.map(m => m.conversation_id))].filter(cid => !convs.has(cid));
  (await Promise.all(missing.map(getConversation))).forEach(c => { if (c) convs.set(c.id, c); });
  return messages
    .map(message => ({ message, conversation: convs.get(message.conversation_id) }))
    .filter(x => x.conversation?.channel === 'sms')
    .filter(x => !(x.message.direction === 'in' && !x.message.logged_for_patient_id && isShared(x.conversation)))
    .sort((a, b) => new Date(b.message.created_at) - new Date(a.message.created_at));
}

export async function updateMessage(id, patch) {
  if (await commsMode() === 'local') {
    const db = readLocal();
    const i = db.messages.findIndex(m => m.id === id);
    if (i < 0) return null;
    db.messages[i] = { ...db.messages[i], ...patch };
    writeLocal(db, { table: 'patient_messages', type: 'UPDATE', row: db.messages[i] });
    return db.messages[i];
  }
  const { data, error } = await supabase.from('patient_messages').update(patch).eq('id', id).select().single();
  if (error) throw error;
  emit({ table: 'patient_messages', type: 'UPDATE', row: data });
  return data;
}

export async function deleteMessage(id) {
  if (await commsMode() === 'local') {
    const db = readLocal();
    const row = db.messages.find(m => m.id === id);
    db.messages = db.messages.filter(m => m.id !== id);
    writeLocal(db, { table: 'patient_messages', type: 'DELETE', row });
    return;
  }
  await supabase.from('patient_messages').delete().eq('id', id);
  emit({ table: 'patient_messages', type: 'DELETE', row: { id } });
}

/** Delete a conversation for good; its messages go with it (ON DELETE CASCADE). */
export async function deleteConversation(id) {
  if (await commsMode() === 'local') {
    const db = readLocal();
    const row = db.conversations.find(c => c.id === id);
    db.conversations = db.conversations.filter(c => c.id !== id);
    db.messages = db.messages.filter(m => m.conversation_id !== id);
    writeLocal(db, { table: 'patient_conversations', type: 'DELETE', row });
    return;
  }
  const { error } = await supabase.from('patient_conversations').delete().eq('id', id);
  if (error) throw error;
  emit({ table: 'patient_conversations', type: 'DELETE', row: { id } });
}

/** Mark a conversation's inbound messages read, from the staff side. */
export async function markConversationRead(conversation) {
  if (!conversation?.unread_count) return;
  await updateConversation(conversation.id, { unread_count: 0 });
  const stamp = now();
  if (await commsMode() === 'remote') {
    // One UPDATE for the whole conversation, not one request per message.
    const { data } = await supabase.from('patient_messages').update({ read_at: stamp })
      .eq('conversation_id', conversation.id).eq('direction', 'in').is('read_at', null)
      .select();
    for (const row of data || []) emit({ table: 'patient_messages', type: 'UPDATE', row });
    return;
  }
  const msgs = await listMessages(conversation.id);
  await Promise.all(msgs.filter(m => m.direction === 'in' && !m.read_at).map(m => updateMessage(m.id, { read_at: stamp })));
}

/**
 * Listen for any change to conversations or messages. The callback gets
 * { table, type, row }; type 'reload' means "re-read everything".
 */
export function subscribeComms(onChange) {
  const local = (e) => onChange(e.detail);
  emitter.addEventListener('change', local);
  let closed = false;
  commsMode().then((mode) => {
    if (mode !== 'remote' || closed) return;
    remoteListeners.add(onChange);
    openSharedChannel();
  });
  return () => {
    closed = true;
    emitter.removeEventListener('change', local);
    remoteListeners.delete(onChange);
    if (!remoteListeners.size) closeSharedChannel();
  };
}

// Every comms hook shares one realtime channel. One per hook meant each
// mounted list opened its own socket subscription on both whole tables.
const remoteListeners = new Set();
let sharedChannel = null;

function openSharedChannel() {
  if (sharedChannel) return;
  const relay = (table) => (p) => {
    const change = { table, type: p.eventType, row: p.new?.id ? p.new : p.old };
    for (const fn of remoteListeners) fn(change);
  };
  sharedChannel = supabase.channel(`comms-${uid()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'patient_conversations' }, relay('patient_conversations'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'patient_messages' }, relay('patient_messages'))
    .subscribe();
}

function closeSharedChannel() {
  sharedChannel?.unsubscribe();
  sharedChannel = null;
}

// ── Patient page (/#/p/<token>, signed out) ───────────────────────────────
// The tables are staff-only, so the patient page never reads them directly:
// it goes through the comms_patient_* functions, which only touch the Chat
// or SMS conversation with that token (supabase/patient_conversations_migration.sql,
// widened to SMS by sms_patient_page_migration.sql).

/** The patient link for a Chat or SMS thread, minting one for an older thread. */
export async function ensurePatientToken(conversation) {
  if (conversation.patient_token) return conversation.patient_token;
  const patient_token = newPatientToken();
  await updateConversation(conversation.id, { patient_token });
  return patient_token;
}

/** { conversation, messages } for a patient link, or null if it's not active. */
export async function getPatientThread(token) {
  if (await commsMode() === 'local') {
    const conversation = readLocal().conversations.find(c => (c.channel === 'chat' || c.channel === 'sms') && c.patient_token === token);
    return conversation ? { conversation, messages: await listMessages(conversation.id) } : null;
  }
  const { data, error } = await supabase.rpc('comms_patient_thread', { p_token: token });
  if (error) throw error;
  return data || null;
}

/** The patient answers in their chat. Resolves to the saved message. */
export async function sendAsPatient(token, body) {
  if (await commsMode() === 'local') {
    const conversation = readLocal().conversations.find(c => (c.channel === 'chat' || c.channel === 'sms') && c.patient_token === token);
    if (!conversation) throw new Error('This link is no longer active.');
    return addMessage({
      conversation_id: conversation.id, kind: 'message', direction: 'in',
      sender_name: conversation.patient_name, body, status: 'delivered',
    });
  }
  const { data, error } = await supabase.rpc('comms_patient_send', { p_token: token, p_body: body });
  if (error) throw error;
  return data;
}

/** The patient has seen what the team sent. */
export async function markReadAsPatient(token) {
  if (await commsMode() === 'local') {
    const thread = await getPatientThread(token);
    const stamp = now();
    await Promise.all((thread?.messages || [])
      .filter(m => m.direction === 'out' && m.kind === 'message' && !m.internal && !m.read_at)
      .map(m => updateMessage(m.id, { read_at: stamp, status: 'read' })));
    return;
  }
  const { error } = await supabase.rpc('comms_patient_mark_read', { p_token: token });
  if (error) throw error;
}

/** Changes made in this browser (own writes, other tabs in local mode). */
export function subscribeLocalComms(onChange) {
  const local = (e) => onChange(e.detail);
  emitter.addEventListener('change', local);
  return () => emitter.removeEventListener('change', local);
}

/** Education content for Send Education: the table, else the built-in list. */
export async function listEducationContent() {
  try {
    const { data, error } = await supabase.from('patient_education_content').select('*').order('title');
    if (!error && data?.length) return data;
  } catch { /* fall back below */ }
  return EDUCATION_LIBRARY.map(c => ({ ...c, source: 'MedlinePlus' }));
}

// Shared-number fields on a conversation (FCS-5677): the custom thread name
// (internal only, never sent) and the rest-of-today session. Each has its
// own column (sms_thread_name_migration.sql, sms_session_migration.sql);
// until a column exists its value is kept in this browser, so the flow can
// still be tried.
const BROWSER_FIELDS = { thread_name: 'fold-sms-thread-names', sms_session: 'fold-sms-sessions' };
function savedField(field) {
  try { return JSON.parse(localStorage.getItem(BROWSER_FIELDS[field]) || '{}'); } catch { return {}; }
}
function withSavedThreadNames(rows) {
  return Object.keys(BROWSER_FIELDS).reduce((acc, field) => {
    const saved = savedField(field);
    return Object.keys(saved).length
      ? acc.map(r => (r[field] == null && saved[r.id] != null ? { ...r, [field]: saved[r.id] } : r))
      : acc;
  }, rows);
}
async function saveConversationField(conversation, field, value) {
  try {
    return await updateConversation(conversation.id, { [field]: value });
  } catch (error) {
    if (!isMissingColumn(error)) throw error;
    const saved = savedField(field);
    if (value != null) saved[conversation.id] = value; else delete saved[conversation.id];
    try { localStorage.setItem(BROWSER_FIELDS[field], JSON.stringify(saved)); } catch { /* storage blocked: this session only */ }
    const row = { ...conversation, [field]: value };
    emit({ table: 'patient_conversations', type: 'UPDATE', row });
    return row;
  }
}

/** Name a shared thread, or clear the name (empty) to show the members' names again. */
export function renameThread(conversation, name) {
  return saveConversationField(conversation, 'thread_name', name?.trim() || null);
}

/**
 * Start (or switch) a shared number's auto-assign session: received SMS go
 * to `member`. `until: 'today'` ends it at local midnight; 'manual' keeps it
 * until someone logs an incoming message by hand (or stops it). `null`
 * member stops it.
 */
export function setSmsSession(conversation, member, { until = 'today' } = {}) {
  if (!member) return saveConversationField(conversation, 'sms_session', null);
  let end = null;
  if (until === 'today') {
    end = new Date();
    end.setHours(24, 0, 0, 0);
  }
  return saveConversationField(conversation, 'sms_session', {
    member_id: String(member.id), member_name: member.name, started_at: now(),
    until: end ? end.toISOString() : null, ends: until,
  });
}
