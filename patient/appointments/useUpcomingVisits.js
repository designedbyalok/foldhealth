import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// The profile's upcoming visits. `refreshKey` changes after a booking.
export function useUpcomingVisits(memberId, refreshKey) {
  const [state, setState] = useState({ loading: true, error: '', visits: [] });

  useEffect(() => {
    let alive = true;
    supabase.rpc('patient_upcoming_appointments', { p_member_id: memberId }).then(({ data, error }) => {
      if (!alive) return;
      setState({ loading: false, error: error ? 'We could not load your visits.' : '', visits: data || [] });
    });
    return () => { alive = false; };
  }, [memberId, refreshKey]);

  return state;
}
