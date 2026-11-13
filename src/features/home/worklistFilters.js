/**
 * My Worklist's filters (Home): each patient row's facts from their
 * appointments, open tasks and profile, the options each filter offers, and
 * whether a row passes. Pure.
 */
import { dobInRange } from '../../components/DateRangePopover/yearSpan';

const normName = (n) => (n || '').trim().toLowerCase();

// "MM-DD-YYYY", "MM/DD/YYYY" or ISO → a local day (ms), or null.
export function dayOf(v) {
  const s = String(v || '').trim();
  const m = /^(\d{2})[-/](\d{2})[-/](\d{4})/.exec(s);
  const d = m ? new Date(+m[3], +m[1] - 1, +m[2]) : (s ? new Date(s.length === 10 ? `${s}T00:00:00` : s) : null);
  if (!d || Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// [fromISO, toISO] inclusive.
function inRange(day, range) {
  if (!range || range.length < 2) return true;
  if (day == null) return false;
  const from = dayOf(range[0]);
  const to = dayOf(range[1]);
  return day >= from && day <= to;
}

const WORKLIST_LABELS = { patients: 'TOC', hcc: 'HCC', snp: 'SNP', hedis: 'HEDIS', awv: 'AWV', ccm: 'CCM' };
const LANGUAGES = { en: 'English', es: 'Spanish', vi: 'Vietnamese', zh: 'Chinese', fr: 'French', hi: 'Hindi', ko: 'Korean', tl: 'Tagalog', ar: 'Arabic', ru: 'Russian' };
const GENDERS = { M: 'Male', F: 'Female' };
const title = (v) => (v ? String(v).charAt(0).toUpperCase() + String(v).slice(1) : '');
const uniq = (xs) => [...new Set(xs.filter(Boolean))];

/** Facts per row: what each filter matches against. */
export function rowFacts(row, { patients = [], appointments = [], tasks = [] } = {}, today = new Date()) {
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const name = normName(row.name);
  const p = patients.find(x => (row.patientId && String(x.id) === String(row.patientId)) || normName(x.name) === name) || {};
  const appts = appointments
    .filter(a => a.status !== 'Cancelled' && normName(a.patient_name) === name)
    .map(a => ({ ...a, day: dayOf(a.date) }))
    .filter(a => a.day != null)
    .sort((a, b) => a.day - b.day);
  const next = appts.find(a => a.day >= t0) || null;
  const last = [...appts].reverse().find(a => a.day < t0) || null;
  const openTasks = tasks.filter(t => t.status !== 'completed' && normName(t.member) === name);
  return {
    nextAppt: next?.day ?? null,
    lastAppt: last?.day ?? null,
    lastProvider: last?.primary_user || '',
    locations: uniq([...appts.map(a => a.location), p.facility]),
    pos: uniq(appts.map(a => a.mode)),
    apptTypes: uniq(appts.map(a => a.appointment_type_name)),
    apptStatuses: uniq(appts.map(a => a.status)),
    reasons: uniq(appts.map(a => a.reason_for_visit)),
    taskDue: openTasks.map(t => dayOf(t.due_date)).filter(d => d != null),
    patientStatus: title(p.status),
    phone: p.phone || '',
    dob: row.dob || p.dob || '',
    age: row.age || p.age,
    gender: GENDERS[row.gender] || row.gender || '',
    language: LANGUAGES[p.language] || (p.language ? String(p.language).toUpperCase() : ''),
    programDue: dayOf(p.dueOn),
    city: p.city || '',
    programs: uniq((row.kinds || [row.kind]).map(k => WORKLIST_LABELS[k])),
    tags: uniq(p.tags || []),
    // For the table: ids, language code, outreach, and the next thing due
    // (the next appointment or open task, whichever is sooner).
    patientId: row.patientId || p.id || null,
    memberId: row.memberId || p.memberId || '',
    langCode: p.language || '',
    outreach: p.outreachDots ? { dots: p.outreachDots, date: p.outreachDate || null, attended: (p.outreachAttended || 0) > 0 } : null,
    nextAction: [next?.day, ...openTasks.map(t => dayOf(t.due_date))].filter(d => d != null).sort((a, b) => a - b)[0] ?? null,
  };
}

/**
 * The filters, in order. `list` filters pick values (any match); `date`
 * filters a day range; `dob` the DOB range.
 */
export const WORKLIST_FILTERS = [
  { key: 'nextAppt', label: 'Next Appointment Date', type: 'date' },
  { key: 'lastAppt', label: 'Last Appointment Date', type: 'date' },
  { key: 'lastProvider', label: 'Last Appointment Provider', type: 'list' },
  { key: 'locations', label: 'Location', type: 'list' },
  { key: 'pos', label: 'POS', type: 'list' },
  { key: 'apptTypes', label: 'Appointment Type', type: 'list' },
  { key: 'apptStatuses', label: 'Appointment Status', type: 'list' },
  { key: 'reasons', label: 'Reason for Visit', type: 'list' },
  { key: 'taskDue', label: 'Tasks Due Date', type: 'date' },
  { key: 'patientStatus', label: 'Patient Status', type: 'list' },
  { key: 'phone', label: 'Phone Number', type: 'list' },
  { key: 'dob', label: 'DOB', type: 'dob' },
  { key: 'gender', label: 'Gender', type: 'list' },
  { key: 'language', label: 'Language', type: 'list' },
  { key: 'programDue', label: 'Program Due Date', type: 'date' },
  { key: 'city', label: 'City', type: 'list' },
  { key: 'programs', label: 'Care Programs/Gaps', type: 'list' },
  { key: 'tags', label: 'Tags', type: 'list' },
];

const asList = (v) => (Array.isArray(v) ? v : (v ? [v] : []));

/** Each list filter's options, from the rows' facts (sorted). */
export function filterOptions(facts) {
  const out = {};
  WORKLIST_FILTERS.filter(f => f.type === 'list').forEach((f) => {
    out[f.key] = uniq(facts.flatMap(x => asList(x[f.key]))).sort((a, b) => String(a).localeCompare(String(b)));
  });
  return out;
}

/** Whether a row's facts pass every set filter (`values`: key → value). */
export function passes(facts, values) {
  return WORKLIST_FILTERS.every((f) => {
    const v = values[f.key];
    if (!v || !v.length) return true;
    if (f.type === 'list') return asList(facts[f.key]).some(x => v.includes(x));
    if (f.type === 'dob') return dobInRange(facts.dob, facts.age, v);
    const days = asList(facts[f.key]);
    return days.some(d => inRange(d, v));
  });
}
