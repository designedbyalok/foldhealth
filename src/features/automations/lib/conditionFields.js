/* The rows of the Edit Condition panel ("field · operator · value"), how each
   reads a patient record, and the plain-language sentence built from the
   filled rows. The same sentence is the canvas card summary and the panel
   footer (the Figma shows two different sentences for one condition).

   A condition node stores { rules: { [fieldKey]: { op, value, unit } } };
   empty rows are ignored. Patient records are all_patients rows in store
   shape (src/store: fetchAllPatients). */

import { CHANNELS } from './catalog';

const opt = (...labels) => labels.map(l => (typeof l === 'string' ? { value: l, label: l } : l));

export const UNITS_AGE = opt({ value: 'years', label: 'Years' }, { value: 'months', label: 'Months' });
export const UNITS_TIME = opt({ value: 'days', label: 'Days' }, { value: 'weeks', label: 'Weeks' }, { value: 'months', label: 'Months' });

// `input`: 'select' | 'multi' | 'number' (number + unit). `ops`: operator
// choices, first is the default. `group`: the section header in the panel.
export const FIELDS = [
  { key: 'contactType', group: 'Contact basic info', label: 'Contact type', ops: ['is', 'is not'], input: 'select', options: opt('Patient', 'Prospect', 'Employee', 'Dependent') },
  { key: 'gender', group: 'Contact basic info', label: 'Gender', ops: ['is', 'is not'], input: 'select', options: opt('Male', 'Female', 'Other') },
  { key: 'sexAtBirth', group: 'Contact basic info', label: 'Sex at birth', ops: ['is', 'is not'], input: 'select', options: opt('Male', 'Female', 'Intersex') },
  { key: 'age', group: 'Contact basic info', label: 'Age', ops: ['is over', 'is under', 'is'], input: 'number', units: UNITS_AGE },
  { key: 'tags', group: 'Contact basic info', label: 'Tags', ops: ['are', 'include any of'], input: 'multi', optionsFrom: 'tags' },
  { key: 'location', group: 'Contact basic info', label: 'Location', ops: ['is', 'is not'], input: 'select', optionsFrom: 'locations' },
  { key: 'registeredFor', group: 'Membership', label: 'Member', ops: ['is registered for', 'is not registered for'], input: 'select', optionsFrom: 'programs' },
  { key: 'lastAppointment', group: 'Membership', label: 'Last appointment', ops: ['is within', 'is more than'], input: 'number', units: UNITS_TIME, suffix: 'ago' },
  { key: 'membership', group: 'Membership', label: 'Membership', ops: ['is'], input: 'select', options: opt('Active member', 'Inactive member', 'Not a member') },
  { key: 'membershipType', group: 'Membership', label: 'Membership type', ops: ['is', 'is not'], input: 'select', options: opt('Employee', 'Spouse', 'Child', 'One-off') },
  { key: 'membershipStart', group: 'Membership', label: 'Membership', ops: ['started within', 'started more than'], input: 'number', units: UNITS_TIME, suffix: 'ago' },
  { key: 'loginStatus', group: 'App login and activity', label: 'Member login status', ops: ['is'], input: 'select', options: opt('Logged in to the app', 'Never logged in') },
  { key: 'lastActivity', group: 'App login and activity', label: 'Last activity', ops: ['was within', 'was more than'], input: 'number', units: UNITS_TIME, suffix: 'ago' },
  { key: 'enrollmentStatus', group: 'Other', label: 'Member enrollment status', ops: ['is'], input: 'select', options: opt('Enrolled', 'Pending', 'Not enrolled') },
  { key: 'employer', group: 'Other', label: 'Employer', ops: ['is', 'is not'], input: 'select', optionsFrom: 'employers' },
  { key: 'consent', group: 'Other', label: 'Member consent', ops: ['is'], input: 'select', options: opt('Consented', 'Not consented') },
  // Fields used by the single-purpose conditions.
  { key: 'emergencyContact', group: 'Contact', label: 'Emergency contact', ops: ['is'], input: 'select', options: opt('On file', 'Missing') },
  { key: 'deactivated', group: 'Contact', label: 'Member', ops: ['is'], input: 'select', options: opt('Deactivated') },
  { key: 'language', group: 'Communication', label: 'Preferred language', ops: ['is', 'is not'], input: 'select', options: opt('English', 'Spanish', 'French', 'Chinese', 'Vietnamese') },
  { key: 'inbox', group: 'Communication', label: 'Communication inbox', ops: ['includes'], input: 'multi', options: opt('Email', 'SMS', 'Chat', 'Phone') },
  { key: 'preferredChannel', group: 'Communication', label: 'Preferred mode', ops: ['is any of'], input: 'channels', options: CHANNELS.map(c => ({ value: c.key, label: c.label })) },
];

const MATCHING_KEYS = ['contactType', 'gender', 'sexAtBirth', 'age', 'tags', 'location', 'registeredFor', 'lastAppointment',
  'membership', 'membershipType', 'membershipStart', 'loginStatus', 'lastActivity', 'enrollmentStatus', 'employer', 'consent'];

export const fieldDef = (key) => FIELDS.find(f => f.key === key) || null;

/** The rows a condition type shows, grouped: [{ group, fields }]. */
export function fieldsFor(conditionDef) {
  const keys = conditionDef?.fields === 'all' ? MATCHING_KEYS : Array.isArray(conditionDef?.fields) ? conditionDef.fields : [];
  const groups = [];
  keys.map(fieldDef).filter(Boolean).forEach(f => {
    let g = groups.find(x => x.group === f.group);
    if (!g) { g = { group: f.group, fields: [] }; groups.push(g); }
    g.fields.push(f);
  });
  return groups;
}

const filled = (r) => r && r.value != null && r.value !== '' && !(Array.isArray(r.value) && !r.value.length);
export const filledRules = (rules) => Object.entries(rules || {}).filter(([, r]) => filled(r));

const unitWord = (unit, n) => {
  const u = (unit || 'days').replace(/s$/, '');
  return Number(n) === 1 ? u : `${u}s`;
};
const list = (arr) => {
  const a = arr.map(String);
  return a.length <= 1 ? (a[0] || '') : `${a.slice(0, -1).join(', ')} and ${a.at(-1)}`;
};
const orList = (arr) => {
  const a = arr.map(String);
  return a.length <= 1 ? (a[0] || '') : `${a.slice(0, -1).join(', ')} or ${a.at(-1)}`;
};

/** One phrase per filled row, e.g. "tagged High Risk and Hypertensive". */
function phrase(key, r) {
  const f = fieldDef(key);
  if (!f) return null;
  const v = r.value;
  const op = r.op || f.ops[0];
  const neg = /not/.test(op);
  switch (key) {
    case 'contactType': return `the contact type ${neg ? 'is not' : 'is'} ${String(v).toLowerCase()}`;
    case 'gender': return `gender ${neg ? 'is not' : 'is'} ${String(v).toLowerCase()}`;
    case 'sexAtBirth': return `sex at birth ${neg ? 'is not' : 'is'} ${String(v).toLowerCase()}`;
    case 'age': return op === 'is' ? `age is ${v} ${unitWord(r.unit || 'years', v)}` : `age ${op} ${v} ${unitWord(r.unit || 'years', v)}`;
    case 'tags': return op === 'are' ? `tagged ${list(v)}` : `tagged ${orList(v)}`;
    case 'location': return `located ${neg ? 'outside' : 'in'} ${v}`;
    case 'registeredFor': return `${neg ? 'not registered' : 'registered'} for ${v}`;
    case 'lastAppointment': return `last appointment ${op === 'is within' ? 'within' : 'more than'} ${v} ${unitWord(r.unit, v)} ago`;
    case 'membership': return v === 'Not a member' ? 'without a membership' : `with an ${String(v).replace(' member', '').toLowerCase()} membership`;
    case 'membershipType': return `membership type ${neg ? 'is not' : 'is'} ${String(v).toLowerCase()}`;
    case 'membershipStart': return `membership started ${op === 'started within' ? 'within' : 'more than'} ${v} ${unitWord(r.unit, v)} ago`;
    case 'loginStatus': return v === 'Never logged in' ? 'never logged in to the app' : 'logged in to the app';
    case 'lastActivity': return `last active ${op === 'was within' ? 'within' : 'more than'} ${v} ${unitWord(r.unit, v)} ago`;
    case 'enrollmentStatus': return `enrollment status is ${String(v).toLowerCase()}`;
    case 'employer': return `employer ${neg ? 'is not' : 'is'} ${v}`;
    case 'consent': return v === 'Consented' ? 'consent on file' : 'no consent on file';
    case 'emergencyContact': return v === 'On file' ? 'an emergency contact on file' : 'no emergency contact on file';
    case 'deactivated': return 'the member is deactivated';
    case 'language': return `preferred language ${neg ? 'is not' : 'is'} ${v}`;
    case 'inbox': return `uses ${orList(v)}`;
    case 'preferredChannel': return `preferred mode is ${orList((v || []).map(k => CHANNELS.find(c => c.key === k)?.label || k))}`;
    default: return null;
  }
}

/** "When the contact type is patient with an active membership and tagged High Risk and Hypertensive". */
export function summarizeRules(rules) {
  const parts = filledRules(rules).map(([k, r]) => phrase(k, r)).filter(Boolean);
  if (!parts.length) return null;
  return `When ${list(parts)}`;
}

// ── Evaluation ──
// Each field reads the patient record when it carries that fact. Facts the
// record doesn't hold (sex at birth, emergency contact, last app activity,
// enrollment status, employer) fall back to a stable per-member draw so a
// simulated run is repeatable; `known: false` marks those in the reasons.

export const hash01 = (s) => {
  let h = 2166136261;
  const str = String(s);
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
};

const daysAgo = (iso, now) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? Math.floor((now - d) / 86400000) : null;
};
const toDays = (n, unit) => Number(n) * (unit === 'weeks' ? 7 : unit === 'months' ? 30 : unit === 'years' ? 365 : 1);
const norm = (s) => String(s ?? '').trim().toLowerCase();
const genderOf = (g) => {
  const n = norm(g);
  if (n.startsWith('m')) return 'male';
  if (n.startsWith('f')) return 'female';
  return n ? 'other' : '';
};

function evalField(key, r, p, now) {
  const op = r.op || fieldDef(key)?.ops[0];
  const neg = /not/.test(op);
  const v = r.value;
  const draw = (rate) => ({ ok: hash01(`${p.id}:${key}:${JSON.stringify(v)}`) < rate, known: false });
  switch (key) {
    case 'contactType': return { ok: (norm(v) === 'patient') !== neg, known: true };
    case 'gender': return { ok: (genderOf(p.gender) === norm(v)) !== neg, known: !!p.gender };
    case 'age': {
      if (p.age == null) return draw(0.5);
      const years = Number(p.age);
      const target = r.unit === 'months' ? Number(v) / 12 : Number(v);
      const ok = op === 'is over' ? years > target : op === 'is under' ? years < target : Math.floor(years) === Math.floor(target);
      return { ok, known: true };
    }
    case 'tags': {
      const tags = (p.tags || []).map(norm);
      const want = (v || []).map(norm);
      const ok = op === 'are' ? want.every(t => tags.includes(t)) : want.some(t => tags.includes(t));
      return { ok, known: true };
    }
    case 'location': {
      const here = [p.city, p.state, p.location].map(norm);
      return { ok: here.includes(norm(v)) !== neg, known: here.some(Boolean) };
    }
    case 'registeredFor': {
      const progs = [p.activeCareProgram].flat().filter(Boolean).map(norm);
      return { ok: progs.some(x => x.includes(norm(v))) !== neg, known: true };
    }
    case 'lastAppointment': {
      const d = daysAgo(p.lastVisit, now);
      if (d == null) return draw(0.4);
      const lim = toDays(v, r.unit);
      return { ok: op === 'is within' ? d <= lim : d > lim, known: true };
    }
    case 'membership': {
      const active = !!p.coverageType;
      return { ok: v === 'Active member' ? active : v === 'Not a member' ? !p.coverageType : !active, known: true };
    }
    case 'membershipType': return draw(neg ? 0.7 : 0.3);
    case 'loginStatus': return { ok: v === 'Never logged in' ? !p.patientAppActive : !!p.patientAppActive, known: true };
    case 'consent': {
      const yes = !!(p.ccmConsent || p.apcmConsent);
      return { ok: v === 'Consented' ? yes : !yes, known: true };
    }
    case 'language': return { ok: (norm(p.language || 'en').startsWith(norm(v).slice(0, 2))) !== neg, known: true };
    case 'inbox': {
      const has = { email: !!p.email, sms: !!p.phone, phone: !!p.phone, chat: !!p.patientAppActive };
      return { ok: (v || []).some(x => has[norm(x)]), known: true };
    }
    case 'deactivated': return { ok: norm(p.status) === 'inactive', known: p.status != null };
    default: return draw(0.65);
  }
}

/** { matched, reasons: [{ ok, text, known }] } for a condition's rules against one patient. */
export function evaluateRules(rules, patient, now = new Date()) {
  const rows = filledRules(rules);
  if (!rows.length) return { matched: true, reasons: [] };
  const reasons = rows.map(([k, r]) => {
    const res = evalField(k, r, patient, now);
    return { ...res, text: phrase(k, r) };
  });
  return { matched: reasons.every(x => x.ok), reasons };
}

/** The member's channel for a preferred-mode split, from what the record holds. */
export function preferredChannelOf(patient) {
  if (patient.preferredChannel) return patient.preferredChannel;
  if (patient.patientAppActive) return 'chat';
  if (patient.email) return 'email';
  if (patient.phone) return 'sms';
  return 'none';
}

/** Option lists that come from data rather than the field definition. */
export function dynamicOptions(patients = [], programs = []) {
  const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
  return {
    tags: uniq(patients.flatMap(p => p.tags || [])).map(t => ({ value: t, label: t })),
    locations: uniq(patients.flatMap(p => [p.city, p.state])).map(t => ({ value: t, label: t })),
    programs: uniq([...programs, ...patients.map(p => p.activeCareProgram)]).map(t => ({ value: t, label: t })),
    employers: uniq(patients.map(p => p.employer || p.groupNumber)).map(t => ({ value: t, label: t })),
  };
}
