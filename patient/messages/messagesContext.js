import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// The profile's conversations, shared by the nav badge and the Messages page
// so they poll once. { conversations, loading, error, unread, refresh }
export const MessagesContext = createContext(null);
export const useMessages = () => useContext(MessagesContext);

const POLL_MS = 30000;

export function useConversationsPoll(memberId) {
  const [state, setState] = useState({ loading: true, error: '', conversations: [] });
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let alive = true;
    supabase.rpc('patient_conversations', { p_member_id: memberId }).then(({ data, error }) => {
      if (alive) setState({ loading: false, error: error ? 'We could not load your messages.' : '', conversations: data || [] });
    });
    return () => { alive = false; };
  }, [memberId, tick]);

  useEffect(() => {
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  const unread = state.conversations.reduce((n, c) => n + (c.unread || 0), 0);
  return { ...state, unread, refresh };
}
