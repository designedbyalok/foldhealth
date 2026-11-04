import { supabase } from '../../lib/supabase';
import { getLocalSeenTours, markLocalTourSeen } from '../../components/ProductTour/ProductTour.utils';

// Which product tours a user has seen: in Supabase so it follows them across
// devices, with localStorage as the instant first check.
const TOUR_STORAGE_KEY = 'fold_seen_tours';
const DB_TABLE = 'user_tour_status';

async function getUserId() {
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id || null;
  } catch { return null; }
}

async function getDbSeenTours(userId) {
  if (!userId) return {};
  try {
    const { data } = await supabase
      .from(DB_TABLE)
      .select('tour_id, seen_at')
      .eq('user_id', userId);
    const map = {};
    (data || []).forEach(row => { map[row.tour_id] = row.seen_at; });
    return map;
  } catch { return {}; }
}

async function markDbTourSeen(userId, tourId) {
  if (!userId) return;
  try {
    await supabase
      .from(DB_TABLE)
      .upsert({ user_id: userId, tour_id: tourId, seen_at: new Date().toISOString() }, { onConflict: 'user_id,tour_id' });
  } catch { /* silent: local fallback covers it */ }
}

export { getUserId, getDbSeenTours, markDbTourSeen, getLocalSeenTours, markLocalTourSeen };

/** Reset a specific tour so it shows again (both local + DB). */
export async function resetTour(tourId) {
  const seen = getLocalSeenTours();
  delete seen[tourId];
  localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(seen));
  const userId = await getUserId();
  if (userId) {
    try {
      await supabase.from(DB_TABLE).delete().eq('user_id', userId).eq('tour_id', tourId);
    } catch { /* silent */ }
  }
}

/** Reset all tours (both local + DB). */
export async function resetAllTours() {
  localStorage.removeItem(TOUR_STORAGE_KEY);
  const userId = await getUserId();
  if (userId) {
    try {
      await supabase.from(DB_TABLE).delete().eq('user_id', userId);
    } catch { /* silent */ }
  }
}

/** ProductTour store: local first, then the user's row in Supabase. */
export const tourStore = {
  async hasSeen(tourId) {
    if (getLocalSeenTours()[tourId]) return true;
    const userId = await getUserId();
    if (!userId) return false;
    const dbSeen = await getDbSeenTours(userId);
    // Sync to local so the next check is instant.
    if (dbSeen[tourId]) markLocalTourSeen(tourId);
    return !!dbSeen[tourId];
  },
  markSeen(tourId) {
    markLocalTourSeen(tourId);
    getUserId().then(userId => { if (userId) markDbTourSeen(userId, tourId); });
  },
};
