// Worklists, tasks and links use different patient id spaces (all_patients
// id, member id, the TOC `patients` id, or just a name). The mobile member
// profile reads `all_patients`, so map whatever we were given onto that row.
//
// Ids are free text, so the same id can name different people in different
// tables. Showing the wrong person's chart is worse than showing none: when
// the spaces disagree and nothing breaks the tie, this returns null.

const norm = (v) => String(v ?? '').replace(/^#/, '').trim().toLowerCase();

export function resolveAllPatient({ allPatients = [], patients = [] }, { id, memberId, name } = {}) {
  const key = norm(id);
  const member = norm(memberId);
  const named = norm(name);
  const byName = (n) => (n ? allPatients.find(p => norm(p.name) === n) || null : null);
  const agrees = (p) => !named || norm(p.name) === named;

  // A Fold ID is unique across every table, so it wins when we have one.
  if (member) {
    const hit = allPatients.find(p => norm(p.memberId) === member);
    if (hit && agrees(hit)) return hit;
  }

  const direct = key
    ? allPatients.find(p => norm(p.id) === key) || allPatients.find(p => norm(p.memberId) === key)
    : null;
  // The same id in the TOC table: its name says which person was meant.
  const toc = key ? patients.find(p => norm(p.id) === key) : null;
  const tocDisagrees = !!(direct && toc && norm(toc.name) !== norm(direct.name));

  if (direct && agrees(direct) && !tocDisagrees) return direct;
  if (named) return byName(named);
  if (tocDisagrees) return null;
  return byName(norm(toc?.name));
}
