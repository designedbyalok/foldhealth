/** Drop retired worklist labels from saved order / deep links. */
export function normalizeWorklistLabel(label) {
  if (label === 'HCC (Archived)') return 'HCC';
  return label;
}

/** Default SubNav worklist order: mirrors SubNav.jsx WORKLISTS. */
export const DEFAULT_WORKLIST_LABELS = [
  'SNP',
  'Annual Visit',
  'TOC IP',
  'HCC',
  'Pharmacy',
  'HEDIS',
  'CCM',
  'JSA',
  'CMP',
  'High Utilizers',
  'DM',
  'TCM',
];

/** Read the cached sidenav order from localStorage (with legacy TOC migration). */
export function readCachedWorklistOrder() {
  try {
    const cached = JSON.parse(localStorage.getItem('worklistOrder') || 'null');
    if (!Array.isArray(cached) || cached.length === 0) return null;
    if (cached.includes('TOC')) {
      const hasTcm = cached.includes('TCM');
      return cached
        .map((l) => (l === 'TOC' ? (hasTcm ? 'TOC IP' : 'TCM') : l))
        .filter((l) => l !== 'HCC (Archived)');
    }
    return cached.filter((l) => l !== 'HCC (Archived)');
  } catch {
    return null;
  }
}

/** First worklist label in the user's order, or SNP when unset. */
export function getFirstWorklistLabel(order = null) {
  const resolved = order || readCachedWorklistOrder();
  if (resolved?.length) return normalizeWorklistLabel(resolved[0]);
  return DEFAULT_WORKLIST_LABELS[0];
}

/** Population tab state for worklists that expose Worklist / Queue tabs. */
export function tabPatchForWorklist(list) {
  if (list === 'TOC IP') return { activeTab: 'toc-queue' };
  if (list === 'TCM') return { activeTab: 'toc-worklist' };
  return {};
}

/** When landing on Population before the user picks a list, open the top sidenav worklist. */
export function populationEntryPatch(state) {
  if (state._subnavNavigated) return {};
  const first = normalizeWorklistLabel(state.worklistOrder?.[0] || getFirstWorklistLabel());
  return { activeSubnavList: first, ...tabPatchForWorklist(first) };
}
