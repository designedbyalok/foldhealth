const pad = n => String(n).padStart(2, '0');

/** MM/DD/YYYY */
export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
}

// clinical_notes.status is draft | submitted | signed. A signed note saved
// again a minute or more after signing reads as amended (the edit trigger
// bumps updated_at; signing sets signed_at and updated_at together).
const AMEND_GRACE_MS = 60 * 1000;
function isAmended(n) {
  if (n.status !== 'signed' || !n.signedAt || !n.updatedAt) return false;
  return Date.parse(n.updatedAt) - Date.parse(n.signedAt) > AMEND_GRACE_MS;
}

/**
 * The one place a note's stored status turns into what the tab shows: its
 * label, colour, and the header view it falls under.
 */
export function noteStatus(n) {
  if (isAmended(n)) return { label: 'Amended', tone: 'neutral', view: 'amended' };
  if (n.status === 'signed') return { label: 'Signed', tone: 'success', view: 'signed' };
  if (n.status === 'submitted') return { label: 'Pending Review', tone: 'warning', view: 'inProgress' };
  return { label: 'In Progress', tone: 'warning', view: 'inProgress' };
}

export const VIEWS = [
  { key: 'all', label: 'All' },
  { key: 'signed', label: 'Signed' },
  { key: 'inProgress', label: 'In Progress' },
  { key: 'amended', label: 'Amended' },
];

function titles(n, template) {
  const codes = n.gapCodes || [];
  const isNormal = n.formType === 'normal_note';
  const isNonVisit = n.formType === 'non_visit_note' || isNormal;
  const isTemplateDriven = !!template && n.payload?.answers && typeof n.payload.answers === 'object';
  const title = isTemplateDriven
    ? template.name
    : isNonVisit
      ? (n.payload?.title || (isNormal ? 'Clinical Note' : 'Non-Visit Note'))
      : codes.length > 1
        ? 'Consolidated Clinical Note'
        : codes[0] ? `${codes[0]} Visit Note` : 'Clinical Note';
  const templateName = template?.name
    || (isNormal ? 'Clinical Note' : isNonVisit
      ? 'Non-Visit Note'
      : (n.formType || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        || (codes[0] ? `${codes[0]} Visit Note` : 'Clinical Note'));
  return { title, templateName };
}

/**
 * A note plus what its row shows and sorts on. `linkedTasks` are the paired
 * Request-for-Sign-off task (reviewTaskId) and any task naming the note.
 */
export function buildNoteRow(n, { templatesById, tasksByNote, tasksById }) {
  const template = n.formId ? templatesById?.[n.formId] : null;
  const { title, templateName } = titles(n, template);
  const codes = n.gapCodes || [];
  const reviewTask = n.reviewTaskId ? tasksById.get(String(n.reviewTaskId)) : null;
  const fromIndex = tasksByNote.get(n.id) || [];
  const linkedTasks = reviewTask ? [reviewTask, ...fromIndex.filter(t => t.id !== reviewTask.id)] : fromIndex;
  const status = noteStatus(n);
  return {
    ...n,
    title,
    diagnosis: codes.length ? codes.join(' · ') : null,
    templateName,
    statusInfo: status,
    updatedByName: n.signedByName || n.reviewerName || n.authorName || null,
    linkedTasks,
    sortTitle: title,
    sortStatus: status.label,
    sortAuthor: n.authorName || '',
    sortUpdated: n.updatedAt || n.createdAt || '',
    sortTemplate: templateName,
  };
}

export const matchesQuery = (r, q) => [r.title, r.diagnosis, r.authorName, r.updatedByName, r.templateName]
  .some(v => v && v.toLowerCase().includes(q));

/** Status, Created By and Template filters, each with options from these rows. */
export function filterDefsFor(rows) {
  const uniq = list => [...new Set(list.filter(Boolean))].sort();
  const defs = [
    { key: 'status', label: 'Status', options: uniq(rows.map(r => r.statusInfo.label)), test: (r, v) => v.includes(r.statusInfo.label) },
    { key: 'createdBy', label: 'Created By', options: uniq(rows.map(r => r.authorName)), test: (r, v) => v.includes(r.authorName) },
    { key: 'template', label: 'Template', options: uniq(rows.map(r => r.templateName)), test: (r, v) => v.includes(r.templateName) },
  ];
  return defs.filter(d => d.options.length).map(d => ({ ...d, primary: true }));
}

export function applyFilters(rows, defs, filters) {
  return rows.filter(r => defs.every(d => !(filters[d.key] || []).length || d.test(r, filters[d.key])));
}
