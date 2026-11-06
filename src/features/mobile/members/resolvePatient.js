// Worklists, tasks and links use different patient id spaces (all_patients
// id, member id, the TOC `patients` id, or just a name). The mobile member
// profile reads `all_patients`, so map whatever we were given onto that row.

const norm = (v) => String(v ?? '').replace(/^#/, '').trim().toLowerCase();

export function resolveAllPatient({ allPatients = [], patients = [] }, { id, memberId, name } = {}) {
  const key = norm(id);
  const member = norm(memberId);
  const named = norm(name);
  if (key) {
    const hit = allPatients.find(p => norm(p.id) === key) || allPatients.find(p => norm(p.memberId) === key);
    if (hit) return hit;
  }
  if (member) {
    const hit = allPatients.find(p => norm(p.memberId) === member);
    if (hit) return hit;
  }
  // A TOC patient id: go through its name.
  const toc = key ? patients.find(p => norm(p.id) === key) : null;
  const byName = named || norm(toc?.name);
  return byName ? allPatients.find(p => norm(p.name) === byName) || null : null;
}
