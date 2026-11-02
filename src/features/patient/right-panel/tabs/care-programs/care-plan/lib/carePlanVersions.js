// Every flavour of note event on one entity is the same running note.
export const NOTE_ACTIONS = new Set(['note', 'note_deleted', 'note_cleared']);

// Events that stand outside the signed-version scope. `note_linked` marks a
// goal, intervention or barrier a care note references with "/".
export const STANDALONE_ACTIONS = new Set([...NOTE_ACTIONS, 'note_linked', 'restored']);

// Audit rows grouped into the versions their signatures close. Signing is what
// cuts a version, so every row written since the previous signature belongs to
// the version that signature closes; rows after the newest signature belong to
// no version yet and are dropped.
export function groupByVersion(entries) {
  const oldestFirst = [...(entries || [])].reverse();
  const groups = [];
  let rows = [];
  for (const e of oldestFirst) {
    if (e.action === 'signed') {
      groups.push({ id: e.id, signed: e, createdAt: e.createdAt, actor: e.actor, rows });
      rows = [];
    } else if (!STANDALONE_ACTIONS.has(e.action)) {
      rows.push(e);
    }
  }
  return groups.reverse();
}

// Notes and restores happen whether or not anyone signs, so they are events in
// their own right rather than part of a version's difference. Newest first, to
// match how the audit trail is read.
export function standaloneEvents(entries) {
  return (entries || []).filter(e => STANDALONE_ACTIONS.has(e.action));
}

// signCarePlan writes its summary as "Signed (v3)".
export function versionNumberOf(signed) {
  const match = /\(v(\d+)\)/.exec(signed?.summary || '');
  return match ? Number(match[1]) : null;
}

export function versionLabel(signed) {
  const n = versionNumberOf(signed);
  return n ? `v${n}` : null;
}

// "Priority: Low → High" / "81% - High → 85% - High" → its parts.
function parseChange(detail) {
  const arrow = (detail || '').split('→');
  if (arrow.length !== 2) return null;
  let [from, to] = arrow.map(v => v.trim());
  let label = null;
  const labelled = /^([A-Za-z][^:]{0,39}): (.*)$/.exec(from);
  if (labelled) {
    label = labelled[1];
    from = labelled[2].trim();
  }
  return { label, from, to };
}

/**
 * The net difference a version made, not the keystrokes that got there. A
 * version is bounded by two signatures, so only the state at each end matters:
 * five edits to one note collapse to the note as it stands, a progress value
 * that moved 81 → 71 → 85 reads 81 → 85, and anything added then removed
 * inside the same version drops out entirely.
 *
 * `rows` are oldest-first. Template rows pass through untouched, they already
 * describe a whole apply.
 */
export function netVersionRows(rows) {
  const all = rows || [];
  const templates = all.filter(r => r.entityType === 'template');
  const byEntity = new Map();
  for (const r of all) {
    if (r.entityType === 'template') continue;
    // Every note event in a version, on the plan or on any goal / barrier,
    // presents as the same "Care Plan Note Updated" line, so they share one
    // bucket and the version reports the note as it finally stands.
    const key = NOTE_ACTIONS.has(r.action)
      ? 'notes'
      : `${r.entityType}:${r.entityId ?? r.summary}`;
    if (!byEntity.has(key)) byEntity.set(key, []);
    byEntity.get(key).push(r);
  }

  const out = [];
  for (const list of byEntity.values()) {
    const created = list.find(r => r.action === 'created');
    const deleted = [...list].reverse().find(r => r.action === 'deleted');
    // Added and removed between the same two signatures: neither version has
    // it, so the version made no difference here.
    if (created && deleted) continue;
    if (deleted) { out.push(deleted); continue; }
    // A new item is reported as added; the edits that shaped it are part of
    // the state it arrived in.
    if (created) { out.push(created); continue; }

    const notes = list.filter(r => NOTE_ACTIONS.has(r.action));
    if (notes.length) out.push(notes.at(-1));

    const merged = new Map();
    for (const r of list) {
      if (NOTE_ACTIONS.has(r.action)) continue;
      const parsed = parseChange(r.detail);
      const key = `${r.action}|${parsed?.label || ''}`;
      const seen = merged.get(key);
      if (!seen) merged.set(key, { row: r, first: parsed, last: parsed });
      else { seen.last = parsed; }
    }
    for (const { row, first, last } of merged.values()) {
      if (!first || !last) { out.push(row); continue; }
      // Ended where it began, so the two signed versions agree.
      if (first.from === last.to) continue;
      out.push({
        ...row,
        detail: `${last.label ? `${last.label}: ` : ''}${first.from} → ${last.to}`,
      });
    }
  }

  out.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
  return [...templates, ...out];
}
