/* Per-IPA overlays on care plan templates. An MSO keeps one account-level
   template and lets each IPA vary it: hide items, change priority or goal
   cadence, reword items for patients, add local items, and require who signs.
   The overlay sits on top of whichever template version is in effect, keyed
   by item title, so it survives new versions. Pure JS; the store reads and
   writes (ipaOverlaysSlice) and applies it when a template goes on a plan.

   overrides: {
     items: { 'goal:<title>': { hidden, priority, frequency, duration, durationUnit, patientTitle }, ... },
     additions: { goals: [], interventions: [], barriers: [] },
     signoff: { mode: 'default' | 'roles' | 'people', roles: [], people: [{ id, name }] },
   } */

const norm = (s) => String(s ?? '').trim().toLowerCase();
const LISTS = [['goal', 'goals'], ['intervention', 'interventions'], ['barrier', 'barriers']];
export const OVERRIDE_FIELDS = {
  goal: ['priority', 'frequency', 'duration', 'durationUnit', 'patientTitle'],
  intervention: ['priority', 'patientTitle'],
  barrier: ['priority', 'patientTitle'],
};

export const itemKey = (kind, title) => `${kind}:${norm(title)}`;

/** The registry IPA a patient's recorded IPA value names (by name or alias), or null. */
export function matchIpa(raw, ipas) {
  const v = norm(raw);
  if (!v) return null;
  return (ipas || []).find(i => i.active !== false && (norm(i.name) === v || (i.aliases || []).some(a => norm(a) === v))) || null;
}

/** IPA values on patient records that no registry IPA covers, with counts. */
export function unmatchedIpaValues(counts, ipas) {
  return (counts || []).filter(c => c.value && !matchIpa(c.value, ipas)).sort((a, b) => b.n - a.n);
}

// Only the fields an override actually sets.
const setFields = (kind, o = {}) => Object.fromEntries(
  OVERRIDE_FIELDS[kind].filter(f => o[f] !== undefined && o[f] !== null && o[f] !== '').map(f => [f, o[f]]),
);

/**
 * Template content with an overlay applied: hidden items drop out, overridden
 * fields go on the entry and on `entry.overlay` (which the apply step lets win
 * over the goals library), and local additions are appended.
 */
export function applyOverlay(content, overrides = {}) {
  const items = overrides.items || {};
  const out = { ...content };
  for (const [kind, listKey] of LISTS) {
    const kept = (content?.[listKey] || [])
      .filter(x => !items[itemKey(kind, x.title)]?.hidden)
      .map((x) => {
        const o = setFields(kind, items[itemKey(kind, x.title)]);
        if (!Object.keys(o).length) return x;
        const entry = { ...x, ...o, overlay: o };
        if (kind === 'intervention' && o.priority) entry.config = { ...(x.config || {}), priority: o.priority };
        return entry;
      });
    const added = (overrides.additions?.[listKey] || []).map(x => ({ ...x, overlay: setFields(kind, x), local: true }));
    out[listKey] = [...kept, ...added];
  }
  return out;
}

/** What an overlay changes against the template: counts, plus overrides for items no longer in it. */
export function overlaySummary(content, overrides = {}) {
  const items = overrides.items || {};
  const present = new Set(LISTS.flatMap(([kind, listKey]) => (content?.[listKey] || []).map(x => itemKey(kind, x.title))));
  let hidden = 0;
  let changed = 0;
  const orphaned = [];
  for (const [key, o] of Object.entries(items)) {
    if (!present.has(key)) { orphaned.push(key); continue; }
    if (o?.hidden) hidden += 1;
    else if (Object.keys(setFields(key.split(':')[0], o)).length) changed += 1;
  }
  const added = LISTS.reduce((n, [, listKey]) => n + (overrides.additions?.[listKey] || []).length, 0);
  return { hidden, changed, added, orphaned, signoff: signoffLabel(overrides.signoff) };
}

// ── Sign-off routes ──

export const SIGNOFF_MODES = ['default', 'roles', 'people'];

/** "Physician/Doctor or Nurse", "Dr. Kim", or null when anyone may sign. */
export function signoffLabel(route) {
  if (!route || route.mode === 'default') return null;
  if (route.mode === 'roles') return (route.roles || []).length ? route.roles.join(' or ') : null;
  if (route.mode === 'people') return (route.people || []).length ? route.people.map(p => p.name).join(' or ') : null;
  return null;
}

/** Whether `profile` ({ id, name, clinicalRoles, adminRole }) may sign under `route`. */
export function signoffAllows(route, profile) {
  if (!signoffLabel(route)) return true;
  if (!profile) return false;
  if (route.mode === 'people') return route.people.some(p => (p.id && p.id === profile.id) || norm(p.name) === norm(profile.name));
  const mine = new Set([...(profile.clinicalRoles || []), profile.adminRole].filter(Boolean).map(norm));
  return route.roles.some(r => mine.has(norm(r)));
}

/**
 * Who may not sign a plan: the routes on its active template runs that the
 * profile doesn't meet. Each item: { templateName, ipaName, label }.
 */
export function blockedSignoffs(instances, profile) {
  return (instances || [])
    .filter(i => i.status === 'active' && i.signoffRoute && !signoffAllows(i.signoffRoute, profile))
    .map(i => ({ templateName: i.templateName, ipaName: i.signoffRoute.ipaName || '', label: signoffLabel(i.signoffRoute) }));
}
