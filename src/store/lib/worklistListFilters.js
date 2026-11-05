/** Maps shared worklist labels to Zustand filter slice keys. */
export const LIST_FILTER_KEY = {
  HCC: 'hccFilters',
  HEDIS: 'hedisFilters',
  SNP: 'snpFilters',
  AWV: 'awvFilters',
  JSA: 'jsaFilters',
  CCM: 'ccmFilters',
  Pharmacy: 'pharmacyFilters',
  CMP: 'cmpFilters',
};

export function detachSaved(activeSavedIdByList, list) {
  if (!activeSavedIdByList || !(list in activeSavedIdByList)) return activeSavedIdByList;
  const next = { ...activeSavedIdByList };
  delete next[list];
  try {
    localStorage.setItem('activeSavedIdByList', JSON.stringify(next));
  } catch { /* quota / private mode */ }
  return next;
}

export function readSavedFiltersByList() {
  try {
    const raw = localStorage.getItem('savedFiltersByList');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch { /* fall through */ }
  try {
    const legacy = localStorage.getItem('hccSavedFilters');
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (Array.isArray(parsed)) return { HCC: parsed };
    }
  } catch { /* */ }
  return {
    HCC: [
      { id: 'sf1', name: 'High Risk Members', filters: { rl: ['High'] } },
      { id: 'sf2', name: 'Overdue Incomplete', filters: { supS: ['Assign'], cdrS: ['Assign'] } },
    ],
  };
}

export function readActiveSavedIdByList() {
  try {
    const raw = localStorage.getItem('activeSavedIdByList');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch { /* */ }
  const legacy = localStorage.getItem('hccActiveSavedId');
  return legacy ? { HCC: legacy } : {};
}

export function hydrateListFilters(list) {
  const active = readActiveSavedIdByList()[list];
  if (!active) return {};
  const f = (readSavedFiltersByList()[list] || []).find(x => x.id === active);
  return f ? { ...f.filters } : {};
}

/**
 * Whether two filter maps pick the same values, ignoring empty entries,
 * key order and value order. Used to tell an edited saved filter apart.
 */
export function sameFilters(a = {}, b = {}) {
  const norm = (f) => Object.fromEntries(
    Object.entries(f || {})
      .filter(([, v]) => (Array.isArray(v) ? v.length > 0 : v != null && v !== ''))
      // Arrays compare as sets; objects (e.g. CCM's { user, threshold }) by value.
      .map(([k, v]) => [k, Array.isArray(v) ? [...v].map(String).sort() : typeof v === 'object' ? JSON.stringify(v) : String(v)])
      .sort(([x], [y]) => x.localeCompare(y)),
  );
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}
