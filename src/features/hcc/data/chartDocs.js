// Chart documents for the ChartPopover + ChartDetailDrawer.
//
// Three document types map to real bundled PDFs (served from /public/charts);
// anything the user uploads is appended (persisted in the store) and falls
// back to a generated note in the drawer's PDF viewer.

const KNOWN_DOCS = [
  { n: 'Progress Note.pdf',     t: 'Visit Note',      pdf: '/charts/progress-note.pdf' },
  { n: 'Laboratory Report.pdf', t: 'Lab Report',      pdf: '/charts/laboratory-report.pdf' },
  { n: 'Radiology Report.pdf',  t: 'Imaging Reports', pdf: '/charts/radiology-report.pdf' },
];

// Stable per-member key (members are `hcc-N`; fall back to name+date).
function memberKey(member) {
  return member?.id || `${member?.name || ''}|${member?.date || ''}`;
}

// Small deterministic hash so a member's default doc set is stable across
// renders (never re-randomises on each popover open).
function seed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function docDate(member) {
  return member?.dos || member?.dos_list?.[0]?.date || member?.date || '—';
}

/**
 * System (pre-existing) documents for a member. Patients with no chart on file
 * (member.ch == null) stay empty. Everyone else gets a randomised-but-stable
 * count kept UNDER 3 (1 or 2), drawn from the PDF-backed known types so every
 * default doc opens a real PDF. Each doc carries the record we surface on the
 * document card: caption, type, date added and who added it.
 */
export function generateDefaultCharts(member) {
  if (member?.ch == null) return [];
  const count = 1 + (seed(memberKey(member)) % 2); // 1 or 2 → under 3
  const dos = docDate(member);
  const addedBy = `${member?.sup || 'Benjamin Cummings'} (Support Team)`;
  // Default doc status follows Support's actual state so the worklist +
  // DiagPanel + Doc Review drawer never disagree:
  //   Support has an assignee AND supS === Completed → docs default Passed
  //   Support has an assignee AND supS === Reject    → docs default Failed
  //   anything else — including Support unassigned   → Pending
  // Requiring an assignee is intentional: docs can't be "passed" by nobody,
  // so a row with Support = "Assign" always shows All Pending, no matter
  // what stale legacy `supS` field the seed carries. A per-doc override
  // (member.docStatus[i]) still wins when provided.
  const supS = member?.supS;
  const hasSupportAssignee = !!(member?.sup && member.sup.trim());
  const supportDefault = (hasSupportAssignee && supS === 'Completed')
    ? 'Passed'
    : (hasSupportAssignee && supS === 'Reject') ? 'Failed'
    : 'Pending';
  return KNOWN_DOCS.slice(0, count).map((d, i) => {
    const st = member?.docStatus?.[i];
    const status = st ? st.charAt(0).toUpperCase() + st.slice(1) : supportDefault;
    return {
      id: `${memberKey(member)}::sys${i}`,
      n: d.n,
      caption: d.n,
      t: d.t,
      pdf: d.pdf,
      dateAdded: dos,
      addedBy,
      meta: `${dos} · ${d.t}`,
      status,
    };
  });
}

/**
 * Full document list. `added` are the rows persisted in Supabase
 * (hcc_added_charts) once the migration + seed have run: the seeded system
 * defaults use `::sys` ids (mirroring generateDefaultCharts) and user uploads
 * use `::upload` ids. When the seeded defaults are present we use the DB rows
 * as the source of truth (so nothing is doubled); before the seed exists we
 * fall back to generating the defaults on the client.
 */
export function getChartDocs(member, added = [], statusOverrides = {}, removedIds = []) {
  const hasSeededDefaults = (added || []).some(d => /::sys\d+$/.test(d.id || ''));
  const base = hasSeededDefaults ? [] : generateDefaultCharts(member);
  let all = [...base, ...(added || [])];
  // Drop unlinked docs. One filter covers both client-seeded `::sys` defaults
  // (which live in no store array) and uploaded/DB docs.
  if (removedIds && removedIds.length) {
    const removed = new Set(removedIds);
    all = all.filter(d => !removed.has(d.id));
  }
  // An explicit persisted override (from hcc_chart_status — a real Pass/Fail
  // a user recorded in the drawer) is authoritative and ALWAYS wins. It must
  // never be discarded, even when Support currently shows no assignee: the
  // doc-status write and the support-assignee write are separate, non-atomic
  // persists, so a member can legitimately have a persisted Passed doc while
  // its support assignment is (transiently) missing. Forcing such docs back
  // to Pending here silently reverted the user's saved review on refresh.
  //
  // The "force Pending when Support is unassigned" rule only exists to hide
  // STALE SEED DEFAULTS (generateDefaultCharts / member.docStatus) — docs
  // that were never actually reviewed. So it applies only to docs WITHOUT an
  // explicit override.
  const overrides = (statusOverrides && Object.keys(statusOverrides).length) ? statusOverrides : null;
  const hasSupportAssignee = !!(member?.sup && String(member.sup).trim());
  return all.map(d => {
    if (overrides && overrides[d.id]) return { ...d, status: overrides[d.id] };
    if (!hasSupportAssignee) return { ...d, status: 'Pending' };
    return d;
  });
}

// Document types offered when uploading a new chart (shared by the upload
// drawer and the inline upload panel in the Document Available drawer).
export const DOC_TYPES = [
  'Visit Note',
  'Lab Report',
  'Radiology Report',
  'Discharge Summary',
  'Referral Letter',
  'Consultation Report',
  'Other',
];

/**
 * Build the doc record for a user-uploaded chart. Shared by both upload entry
 * points so the shape stays identical. Pass the raw `file` for in-session
 * preview via FilePreview; once persisted, the Supabase Storage URL replaces it.
 */
export function makeUploadedChartDoc(member, { file, caption, docType, visitType, status = 'Pending' }) {
  const uploadedOn = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  const cap = (caption || '').trim();
  // Caption is the user-facing document name (surfaces in the worklist
  // Documents column AND the DiagPanel Documents tab). Fall back to the
  // raw filename when the caption wasn't set.
  const displayName = cap || file?.name || 'Document';
  return {
    id: `${memberKey(member)}::upload${Date.now()}`,
    n: displayName,
    caption: displayName,
    t: docType,
    vt: visitType || undefined,
    file,
    fname: file?.name || '',
    ext: ((file?.name || '').match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase(),
    dateAdded: uploadedOn,
    addedBy: 'You',
    meta: visitType ? `${uploadedOn} · ${docType} · ${visitType}` : `${uploadedOn} · ${docType}`,
    status,
  };
}
