const TOUR_STORAGE_KEY = 'fold_seen_tours';

function getLocalSeenTours() {
  try {
    return JSON.parse(localStorage.getItem(TOUR_STORAGE_KEY) || '{}');
  } catch { return {}; }
}

function markLocalTourSeen(tourId) {
  const seen = getLocalSeenTours();
  seen[tourId] = Date.now();
  localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(seen));
}

/** Remembers seen tours in this browser only. ProductTour's default store. */
export const localTourStore = {
  hasSeen: (tourId) => !!getLocalSeenTours()[tourId],
  markSeen: (tourId) => markLocalTourSeen(tourId),
};

export { getLocalSeenTours, markLocalTourSeen };
