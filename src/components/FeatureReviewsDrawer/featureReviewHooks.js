import { useEffect, useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';

export const sameEmail = (a, b) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

/** The signed-in user's reviewer row on a feature, if they're assigned. */
export const mySignoff = (feature, email) => feature.reviewers.find(r => sameEmail(r.email, email)) || null;

/**
 * Feature reviews awaiting the signed-in user's sign-off, for the nav badge.
 * Shared so the classic and floating sidebars count the same way.
 */
export function useMyPendingReviewCount() {
  const myEmail = useAppStore(s => s.currentUserProfile?.email);
  return useAppStore(s => s.featureReviews.filter(f => {
    if (f.status !== 'approved') return false;
    const mine = mySignoff(f, myEmail);
    return mine && !mine.signedAt;
  }).length);
}

/**
 * Staff who can be assigned as reviewers, as multi-select options keyed by
 * lowercased email (the sign-off is matched to the signed-in email).
 */
export function useReviewerOptions() {
  const people = useAppStore(s => s.platformPeople);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  useEffect(() => { fetchPlatformUsers?.(); }, [fetchPlatformUsers]);

  return useMemo(() => {
    const byEmail = new Map();
    for (const p of people || []) {
      const email = p.email?.toLowerCase();
      if (email && !byEmail.has(email)) byEmail.set(email, { name: p.name, email });
    }
    const options = [...byEmail.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(p => ({ value: p.email, label: p.name, searchText: `${p.name} ${p.email}` }));
    return { options, byEmail };
  }, [people]);
}
