import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

// Staff-to-staff chat (desktop Internal Chat, MessagesView + ChatArea):
// one-to-one rows in direct_messages. Same reads and writes as desktop.

const PROFILE_COLUMNS = 'id, full_name, first_name, last_name, email, avatar_url';

/** Every Fold user, by id (the names on Internal Chat). */
export function useStaffProfiles() {
  const [profiles, setProfiles] = useState([]);
  useEffect(() => {
    let alive = true;
    supabase.from('profiles').select(PROFILE_COLUMNS)
      .then(({ data }) => { if (alive) setProfiles(data || []); });
    return () => { alive = false; };
  }, []);
  return profiles;
}

/**
 * My internal conversations, one per person, newest first:
 * { userId, lastMessage, lastTime, unreadCount }.
 */
export function useInternalConversations(meId) {
  const [state, setState] = useState({ list: [], loading: true });
  const [key, setKey] = useState(0);
  const reload = useCallback(() => setKey(k => k + 1), []);

  useEffect(() => {
    if (!meId) return undefined;
    let alive = true;
    supabase.from('direct_messages')
      .select('sender_id, recipient_id, content, created_at, read_at, media_type')
      .or(`sender_id.eq.${meId},recipient_id.eq.${meId}`)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!alive) return;
        const byUser = {};
        (data || []).forEach((m) => {
          const other = m.sender_id === meId ? m.recipient_id : m.sender_id;
          if (!byUser[other]) {
            byUser[other] = {
              userId: other,
              lastMessage: m.content || (m.media_type ? 'Sent an attachment' : ''),
              lastTime: m.created_at,
              unreadCount: 0,
            };
          }
          if (m.recipient_id === meId && !m.read_at) byUser[other].unreadCount += 1;
        });
        setState({ list: Object.values(byUser).sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime)), loading: false });
      });
    // A new message for me refreshes the list (desktop 'msg-inbox').
    const ch = supabase.channel(`m-inbox-${meId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `recipient_id=eq.${meId}` }, reload)
      .subscribe();
    return () => { alive = false; ch.unsubscribe(); };
  }, [meId, key, reload]);

  return { ...state, loading: meId ? state.loading : false, reload };
}

/** Bulk "Mark as Read": everything these people sent me (desktop markInternalRead). */
export async function markInternalRead(meId, userIds) {
  if (!meId || !userIds.length) return;
  await supabase.from('direct_messages').update({ read_at: new Date().toISOString() })
    .in('sender_id', userIds).eq('recipient_id', meId).is('read_at', null);
}

/** Upload a file to chat-media as desktop ChatArea does; resolves to its public URL. */
export async function uploadChatMedia(path, file) {
  const { error } = await supabase.storage.from('chat-media').upload(path, file, { upsert: true });
  if (error) throw error;
  return supabase.storage.from('chat-media').getPublicUrl(path).data.publicUrl;
}

/** One person's thread with me, oldest first, kept live, and how to send. */
export function useInternalThread(meId, otherId) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!meId || !otherId) return undefined;
    let alive = true;
    supabase.from('direct_messages').select('*')
      .or(`and(sender_id.eq.${meId},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${meId})`)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (!alive) return;
        const msgs = data || [];
        setMessages(msgs);
        setLoading(false);
        // Opening the thread reads it.
        const ids = msgs.filter(m => m.recipient_id === meId && !m.read_at).map(m => m.id);
        if (ids.length) supabase.from('direct_messages').update({ read_at: new Date().toISOString() }).in('id', ids).then(() => {});
      });
    const onInsert = ({ new: m }) => {
      const mine = (m.sender_id === meId && m.recipient_id === otherId) || (m.sender_id === otherId && m.recipient_id === meId);
      if (!mine) return;
      setMessages(prev => (prev.some(x => x.id === m.id) ? prev : [...prev, m]));
      if (m.recipient_id === meId) supabase.from('direct_messages').update({ read_at: new Date().toISOString() }).eq('id', m.id).then(() => {});
    };
    const ch = supabase.channel(`m-dm-${[meId, otherId].sort().join('-')}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `recipient_id=eq.${meId}` }, onInsert)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `sender_id=eq.${meId}` }, onInsert)
      .subscribe();
    return () => { alive = false; ch.unsubscribe(); };
  }, [meId, otherId]);

  // Same insert as desktop ChatArea.insertMessage (optimistic row, then the saved one).
  const send = useCallback(async ({ content, media }) => {
    const optId = `opt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setMessages(prev => [...prev, {
      id: optId, sender_id: meId, recipient_id: otherId, content, created_at: new Date().toISOString(), read_at: null,
      media_url: media?.url || null, media_type: media?.type || null, media_name: media?.name || null,
    }]);
    // direct_messages.content is NOT NULL: an attachment alone sends ''.
    const payload = { sender_id: meId, recipient_id: otherId, content: content || '' };
    if (media?.url) { payload.media_url = media.url; payload.media_type = media.type; payload.media_name = media.name; }
    const { data, error } = await supabase.from('direct_messages').insert(payload).select().single();
    if (error || !data) {
      setMessages(prev => prev.filter(m => m.id !== optId));
      throw new Error(error?.message || 'The message was not saved.');
    }
    setMessages(prev => prev.map(m => (m.id === optId ? data : m)));
  }, [meId, otherId]);

  return { messages, loading: meId && otherId ? loading : false, send };
}
