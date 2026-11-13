// What closed a care gap instance, from what Fold already links to the gap:
// signed clinical notes, lab results and documents uploaded on the gap.
// Each counts toward the instance whose open–closed window it falls in, so
// two instances of the same measure each show their own evidence. A gap
// closed from payer data with nothing in Fold reads as claim data.

const parseMdY = (s) => {
  const m = String(s || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2])) : null;
};
const fmt = (d) => d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
const isClosed = (status) => status === 'Completed' || String(status || '').startsWith('Closed');

// Inside the instance's window: on or after the day it opened and, once
// closed, on or before the day it closed. Undated gaps take everything.
function inWindow(gap, date) {
  if (!date) return true;
  const start = parseMdY(gap.startDate);
  const end = parseMdY(gap.closedDate);
  if (end) end.setHours(23, 59, 59, 999);
  return (!start || date >= start) && (!end || date <= end);
}

export function gapEvidence(gap, { memberId, notes = [], labResults = [], documents = [] } = {}) {
  const items = [];
  notes
    .filter(n => n.status === 'signed' && (n.gapCodes || []).includes(gap.code))
    .forEach(n => items.push({ kind: 'note', date: n.signedAt ? new Date(n.signedAt) : null, label: `Clinical note signed${n.signedByName ? ` by ${n.signedByName}` : ''}` }));
  labResults
    .filter(r => r.gapCode === gap.code)
    .forEach(r => items.push({ kind: 'lab', date: (r.resultedAt || r.collectedAt) ? new Date(r.resultedAt || r.collectedAt) : null, label: [r.testName || 'Lab result', [r.value, r.unit].filter(Boolean).join(' ')].filter(Boolean).join(' ') }));
  documents
    .filter(d => String(d.id).startsWith('cgdoc-') && String(d.patientId) === String(memberId) && d.programCode === gap.code)
    .forEach(d => items.push({ kind: 'document', date: d.createdAt ? new Date(d.createdAt) : null, label: `Document: ${d.name}` }));
  const found = items
    .filter(x => inWindow(gap, x.date))
    .toSorted((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
  if (!found.length && isClosed(gap.status) && gap.source !== 'fold-native' && (gap.status === 'Completed' || gap.status === 'Closed - Data')) {
    return [{ kind: 'claim', date: null, label: 'Claim data' }];
  }
  return found;
}

// One line for a list row: the latest evidence, its date, and how many more.
export function evidenceSummary(evidence) {
  if (!evidence?.length) return '';
  const [first, ...rest] = evidence;
  return `Evidence: ${first.label}${first.date ? `, ${fmt(first.date)}` : ''}${rest.length ? ` (+${rest.length} more)` : ''}`;
}
