import { useEffect, useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { membersForConversation } from './smsMembers';
import {
  listConversations, listMessages, listMessagesFor, listSmsLoggedFor, subscribeComms, commsMode,
} from './commsRepo';

const upsert = (list, row) => {
  const i = list.findIndex(x => x.id === row.id);
  if (i < 0) return [...list, row];
  const next = [...list];
  next[i] = { ...next[i], ...row };
  return next;
};

/** Every patient conversation, kept live. */
// A load that hasn't answered by then counts as failed, so lists don't sit blank.
const LOAD_TIMEOUT_MS = 15000;
const withTimeout = (p) => Promise.race([
  p,
  new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), LOAD_TIMEOUT_MS)),
]);

export function useCommsConversations() {
  const [state, setState] = useState({ conversations: [], loading: true, failed: false, mode: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = () => withTimeout(Promise.all([listConversations(), commsMode()]))
      .then(([conversations, mode]) => { if (alive) setState({ conversations, loading: false, failed: false, mode }); })
      .catch(() => { if (alive) setState(s => ({ ...s, loading: false, failed: true })); });
    load();
    const off = subscribeComms((change) => {
      if (change.type === 'reload') return load();
      if (change.table !== 'patient_conversations' || !change.row) return;
      setState(s => ({
        ...s,
        conversations: (change.type === 'DELETE'
          ? s.conversations.filter(c => c.id !== change.row.id)
          : upsert(s.conversations, change.row))
          .sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at)),
      }));
    });
    return () => { alive = false; off(); };
  }, [attempt]);

  // Try again after a failed load.
  const retry = () => { setState(s => ({ ...s, loading: true, failed: false })); setAttempt(n => n + 1); };
  return { ...state, retry };
}

/** One conversation's messages, oldest first, kept live. */
export function useCommsMessages(conversationId) {
  const [state, setState] = useState({ id: null, messages: [], loading: true });

  useEffect(() => {
    if (!conversationId) return undefined;
    let alive = true;
    const load = () => listMessages(conversationId)
      .then(messages => { if (alive) setState({ id: conversationId, messages, loading: false }); })
      .catch(() => { if (alive) setState({ id: conversationId, messages: [], loading: false }); });
    load();
    const off = subscribeComms((change) => {
      if (change.type === 'reload') return load();
      if (change.table !== 'patient_messages' || !change.row) return;
      if (change.type === 'DELETE') {
        setState(s => ({ ...s, messages: s.messages.filter(m => m.id !== change.row.id) }));
        return;
      }
      if (change.row.conversation_id !== conversationId) return;
      setState(s => ({
        ...s,
        messages: upsert(s.messages, change.row).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
      }));
    });
    return () => { alive = false; off(); };
  }, [conversationId]);

  // A different conversation was picked: show loading until its rows arrive.
  return state.id === conversationId ? state : { messages: [], loading: true };
}

/** Every message in the given conversations, kept live (for folder views). */
export function useCommsMessagesFor(conversationIds) {
  const key = conversationIds.join(',');
  const [state, setState] = useState({ key: null, messages: [] });

  useEffect(() => {
    let alive = true;
    const ids = key ? key.split(',') : [];
    const load = () => listMessagesFor(ids)
      .then(messages => { if (alive) setState({ key, messages }); })
      .catch(() => { if (alive) setState({ key, messages: [] }); });
    load();
    const off = subscribeComms((change) => {
      if (change.type === 'reload') return load();
      if (change.table !== 'patient_messages' || !change.row) return;
      if (change.type === 'DELETE') {
        setState(s => ({ ...s, messages: s.messages.filter(m => m.id !== change.row.id) }));
        return;
      }
      if (!ids.includes(change.row.conversation_id)) return;
      setState(s => ({ ...s, messages: upsert(s.messages, change.row) }));
    });
    return () => { alive = false; off(); };
  }, [key]);

  return state.key === key ? state.messages : [];
}

/**
 * Every SMS logged for a patient ({ message, conversation }, newest first),
 * reloaded when messages change. Unassigned SMS on a shared number are left
 * out until someone assigns them.
 */
export function usePatientSmsLog(patientId) {
  const [state, setState] = useState({ id: null, items: [] });

  useEffect(() => {
    if (!patientId) return undefined;
    let alive = true;
    // Patients are read at load time, so a new list doesn't reload the log.
    const isShared = (c) => membersForConversation(c, useAppStore.getState().allPatients || []).length > 1;
    const load = () => listSmsLoggedFor({ patientId, isShared })
      .then(items => { if (alive) setState({ id: patientId, items }); })
      .catch(() => { if (alive) setState({ id: patientId, items: [] }); });
    load();
    // A send writes its message twice (queued, then sent): reload once.
    let timer = null;
    const off = subscribeComms((change) => {
      if (change.type !== 'reload' && change.table !== 'patient_messages') return;
      clearTimeout(timer);
      timer = setTimeout(load, 500);
    });
    return () => { alive = false; clearTimeout(timer); off(); };
  }, [patientId]);

  return state.id === patientId ? state.items : [];
}
