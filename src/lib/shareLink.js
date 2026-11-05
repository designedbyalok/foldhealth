/**
 * Builds crawler-friendly share URLs (`/s/<slug>`) that produce per-section
 * link previews. Opening one bounces the human into the matching SPA hash
 * route; social crawlers read the OpenGraph tags served by `api/share.js`.
 *
 * Slugs must match the registry in `api/_lib/ogSections.js`.
 */

/** Absolute `/s/<slug>` URL for a known section slug. */
export function shareUrl(slug) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://foldhealth.vercel.app';
  return `${origin}/s/${slug || 'home'}`;
}

const LIST_TO_SLUG = {
  HCC: 'hcc',
  HEDIS: 'hedis',
  'Annual Visit': 'awv',
  'All Patients': 'all-patients',
};

/**
 * Derive the best share slug for the current store state, mirrors the routing
 * in `src/lib/router.js` so the shared link lands where the user is.
 */
export function sectionSlugFromState(state) {
  const { activePage, activeSubnavList, activeTab } = state;

  if (activePage === 'population' || !activePage) {
    if (activeSubnavList && LIST_TO_SLUG[activeSubnavList]) return LIST_TO_SLUG[activeSubnavList];
    if (activeSubnavList === 'TOC IP') return 'toc';
    if (activeSubnavList === 'TCM') return activeTab === 'toc-queue' ? 'tcm-queue' : 'tcm';
    return activeTab === 'toc-queue' ? 'tcm-queue' : 'tcm';
  }

  // Top-level workspaces share their page name as the slug.
  if (['home', 'calendar', 'tasks', 'messages', 'calls', 'campaign', 'analytics', 'settings'].includes(activePage)) {
    return activePage;
  }

  return 'home';
}

/** Convenience: absolute share URL for the current store state. */
export function currentShareUrl(state) {
  return shareUrl(sectionSlugFromState(state));
}
