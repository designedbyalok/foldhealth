// Inbound eFax with the patient the fax was read as being about.
//
// A fax row keeps what was read off the fax (`extracted`) and a snapshot of
// the suggested patient (`suggested`), so a fax still reads correctly when
// the patient list hasn't loaded. `scenario` is how sure the match is:
//   high:   name, DOB and member ID all match one patient: one-click link
//   review: a likely patient, but a field differs or couldn't be read
//   none:   nobody matched: search for the patient
// Linking files the fax under the patient (`linked*`); it can be changed.

export const EFAX_SENDERS = [
  { name: 'Fold Care Labs', fax: '(303) 555-0105' },
  { name: 'Quest Diagnostics', fax: '(866) 555-0142' },
  { name: 'Cedars Imaging Center', fax: '(310) 555-0188' },
  { name: 'Valley Cardiology Associates', fax: '(818) 555-0123' },
];

export const EFAX_DOCUMENTS = [
  { value: 'Lab Results', file: 'Lab_results' },
  { value: 'Referral', file: 'Patient_referral' },
  { value: 'Imaging Report', file: 'Imaging_report' },
  { value: 'Discharge Summary', file: 'Discharge_summary' },
  { value: 'Prior Authorization', file: 'Prior_authorization' },
];

export const EFAX_SCENARIOS = {
  high: { label: 'Strong match', hint: 'Name, DOB and member ID match one patient.' },
  review: { label: 'Needs review', hint: 'A likely patient, but the DOB differs and the member ID is unreadable.' },
  none: { label: 'No match', hint: 'The name on the fax matches nobody, so the patient has to be searched.' },
};

const NOTES = {
  'Lab Results': 'Please find the attached lab results for your patient.',
  Referral: "This is a referral I'm sending you, please have a look. Thanks",
  'Imaging Report': 'Imaging report attached for your review.',
  'Discharge Summary': 'Discharge summary attached. Please arrange follow-up within 7 days.',
  'Prior Authorization': 'Prior authorization approved, details attached.',
};

/** The fields compared between the fax and the patient record. */
export const MATCH_FIELDS = [
  { key: 'name', label: 'Name' },
  { key: 'dob', label: 'DOB' },
  { key: 'memberId', label: 'Member ID' },
];

/** Patient → the snapshot a fax keeps of who it was matched to. */
export const patientSnapshot = (p) => p && ({
  id: String(p.id),
  name: p.name || '',
  dob: p.dob || '',
  memberId: p.memberId || '',
  gender: p.gender || '',
  age: p.age ?? null,
  phone: p.phone || '',
});

// A DOB one digit off, for a fax that was read slightly wrong.
function nudgeDob(dob) {
  if (!dob) return '01/15/1960';
  return dob.replace(/(\d)(?!.*\d)/, d => String((Number(d) + 3) % 10));
}

const UNMATCHED = { name: 'Marisol Ventura', dob: '07/22/1968', memberId: 'Unreadable' };

/**
 * A new inbound fax about `patient`, read with the given certainty. The
 * fax's own fields are what the sender wrote; for `review` they differ from
 * the record the way an OCR misread would.
 */
export function buildFax({ id, patient, scenario = 'high', sender = EFAX_SENDERS[0], documentType = 'Referral', efaxNumberId = null, now = new Date() }) {
  const doc = EFAX_DOCUMENTS.find(d => d.value === documentType) || EFAX_DOCUMENTS[1];
  const snap = patientSnapshot(patient);
  const extracted = scenario === 'none'
    ? UNMATCHED
    : {
      name: snap.name,
      dob: scenario === 'review' ? nudgeDob(snap.dob) : snap.dob,
      memberId: scenario === 'review' ? 'Unreadable' : snap.memberId,
    };
  return {
    id: id || `efax-${now.getTime()}-${Math.random().toString(16).slice(2, 6)}`,
    senderName: sender.name,
    senderFax: sender.fax,
    documentType: doc.value,
    documentName: `${doc.file}.pdf`,
    pages: scenario === 'none' ? 2 : 3,
    note: NOTES[doc.value],
    receivedAt: now.toISOString(),
    scenario,
    extracted,
    suggested: scenario === 'none' ? null : snap,
    linked: null,
    read: false,
    ...(efaxNumberId ? { efaxNumberId } : {}),
  };
}

/** Per field: does the fax agree with the patient record? */
export function compareFields(extracted, patient) {
  const norm = v => String(v || '').trim().toLowerCase();
  return MATCH_FIELDS.map(({ key, label }) => {
    const fax = extracted?.[key] || '';
    const record = patient?.[key] || '';
    const unreadable = !fax || norm(fax) === 'unreadable';
    return {
      key, label, fax: unreadable ? 'Unreadable' : fax, record: record || 'Not on file',
      state: unreadable ? 'unreadable' : norm(fax) === norm(record) ? 'match' : 'mismatch',
    };
  });
}

// Demo faxes when the table is empty or unreachable (stable ids so re-seeding updates them).
export function sampleFaxes(patients = []) {
  const [a, b] = patients;
  const base = Date.now();
  const at = mins => new Date(base - mins * 60000);
  return [
    a && buildFax({ id: 'efax-sample-1', patient: a, scenario: 'high', sender: EFAX_SENDERS[0], documentType: 'Referral', efaxNumberId: 'efax-1', now: at(12) }),
    b && buildFax({ id: 'efax-sample-2', patient: b, scenario: 'review', sender: EFAX_SENDERS[1], documentType: 'Lab Results', efaxNumberId: 'efax-2', now: at(95) }),
    a && buildFax({ id: 'efax-sample-3', patient: a, scenario: 'none', sender: EFAX_SENDERS[2], documentType: 'Imaging Report', efaxNumberId: 'efax-1', now: at(60 * 26) }),
  ].filter(Boolean);
}

export const faxToRow = f => ({
  id: f.id,
  sender_name: f.senderName,
  sender_fax: f.senderFax,
  document_type: f.documentType,
  document_name: f.documentName,
  pages: f.pages,
  note: f.note,
  received_at: f.receivedAt,
  scenario: f.scenario,
  extracted: f.extracted,
  suggested: f.suggested,
  linked: f.linked,
  read: f.read,
  // Only once set (efax_inbound_number_migration.sql adds the column).
  ...(f.efaxNumberId ? { efax_number_id: f.efaxNumberId } : {}),
});

export const rowToFax = r => ({
  id: r.id,
  senderName: r.sender_name,
  senderFax: r.sender_fax,
  documentType: r.document_type,
  documentName: r.document_name,
  pages: r.pages,
  note: r.note,
  receivedAt: r.received_at,
  scenario: r.scenario,
  extracted: r.extracted || {},
  suggested: r.suggested || null,
  linked: r.linked || null,
  read: !!r.read,
  efaxNumberId: r.efax_number_id || null,
});

// How sure the read is, shown beside what matched (Figma 2916:41416).
export const MATCH_CONFIDENCE = { high: 95, review: 72 };

/**
 * Other patients the fax could be about, for "Other Matches": same last or
 * first name as what was read first, then the nearest names alphabetically.
 */
export function otherMatchesFor(fax, patients = [], limit = 3) {
  const target = String(fax.extracted?.name || '').toLowerCase();
  const words = target.split(/\s+/);
  const first = words[0] || '';
  const last = words[words.length - 1] || '';
  const skip = String(fax.suggested?.id || '');
  const pool = patients.filter(p => p?.name && String(p.id) !== skip);
  const score = (p) => {
    const parts = p.name.toLowerCase().split(/\s+/);
    return (parts.at(-1) === last ? 2 : 0) + (parts[0] === first ? 1 : 0);
  };
  const named = pool.filter(p => score(p) > 0).sort((a, b) => score(b) - score(a));
  // Then the patients listed just around the read name.
  const sorted = [...pool].sort((a, b) => a.name.localeCompare(b.name));
  const at = Math.max(0, sorted.findIndex(p => p.name.toLowerCase().localeCompare(target) >= 0));
  const around = sorted.slice(Math.max(0, at - 1), at - 1 + limit + 1);
  const namedSet = new Set(named);
  return [...named, ...around.filter(p => !namedSet.has(p))].slice(0, limit).map(patientSnapshot);
}

/**
 * Everyone the fax could be about, best first, with a confidence and the
 * fields that agree with the fax: the read patient (MATCH_CONFIDENCE) then
 * other patients by how much of the name agrees. For "Suggested Members"
 * (Figma 2932:39952, 2916:41416).
 */
export function suggestionsFor(fax, patients = []) {
  const read = String(fax.extracted?.name || '').toLowerCase().split(/\s+/);
  const agree = p => compareFields(fax.extracted, p).filter(f => f.state === 'match').map(f => f.label);
  const score = (p) => {
    const parts = p.name.toLowerCase().split(/\s+/);
    const last = parts.at(-1) === read.at(-1);
    const first = parts[0] === read[0];
    if (first && last) return { confidence: 90, matched: agree(p) };
    if (last) return { confidence: 68, matched: ['Last Name'] };
    if (first) return { confidence: 45, matched: ['First Name'] };
    return { confidence: 15, matched: [] };
  };
  const top = fax.suggested && {
    patient: fax.suggested,
    confidence: MATCH_CONFIDENCE[fax.scenario],
    matched: agree(fax.suggested),
  };
  // A "no match" read only offers patients who share part of the name; with
  // none, the OCR found nobody and the list is empty (the no-matches state).
  const others = otherMatchesFor(fax, patients, 4).map(p => ({ patient: p, ...score(p) }))
    .filter(o => fax.scenario !== 'none' || o.matched.length > 0)
    .sort((a, b) => b.confidence - a.confidence);
  return [top, ...others].filter(Boolean);
}
