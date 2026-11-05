import { parseLocalDate } from '../../../lib/localDate';

/**
 * CIS-CMB10: Childhood Immunization Status, Combination 10.
 *
 * Children who turn 2 during the measurement year need all ten antigens
 * below by their 2nd birthday. Two rule sets run side by side and are never
 * merged:
 *   • HEDIS counting rules decide which recorded doses count (min ages,
 *     1st-2nd birthday windows, nothing after the 2nd birthday, one dose
 *     per antigen per day).
 *   • ACIP planning rules (min intervals, per-dose min ages, the routine
 *     schedule) decide when the next dose is due and whether the remaining
 *     doses can still fit before the 2nd birthday.
 *
 * Verify the antigen table against the current NCQA tech specs each
 * measurement year; dose counts and windows move between years.
 */

export const CIS_CODE = 'CIS-CMB10';

export const CIS_ANTIGEN_STATUS = {
  met: 'Met',
  dueNow: 'Due Now',
  overdue: 'Overdue',
  upcoming: 'Upcoming',
  onTrack: 'On-Track',
  cannotMeet: "Can't Meet",
};

export const CIS_DOSE_STATUS = {
  completed: 'Completed',
  // Counts for HEDIS, but was given after the dose's recommended window.
  completedLate: 'Completed late',
  notCounted: 'Does Not Count',
  pending: 'Enter date',
  dueNow: 'Due now',
  overdue: 'Overdue',
  upcoming: 'Upcoming',
  onTrack: 'On track',
  cannotMeet: "Can't be met",
};

export const CIS_EVALUATION = {
  compliant: 'Compliant',
  onTrack: 'On track',
  atRisk: 'At risk',
  cannotMeet: "Can't be met",
  notEligible: 'Not eligible',
};

// A gap with this many days or fewer before the 2nd birthday, and doses
// still outstanding, is At risk even when nothing is overdue yet.
export const AT_RISK_DAYS = 60;

// Rotavirus: Rotarix is a 2-dose series, RotaTeq (or an unknown brand) 3.
const ROTARIX_CVX = ['119'];
const ROTARIX_RE = /rotarix/i;
// Live attenuated influenza only counts when given on the 2nd birthday.
const LAIV_CVX = ['111', '149'];
const LAIV_RE = /laiv|flumist/i;
// No rotavirus dose after 8 months of age (ACIP); the last dose's window
// ends there.
const RV_MAX_AGE_MONTHS = 8;

/**
 * `schedule` is the recommended window per dose, from the CIS-10 Vaccine
 * Calendar sheet: it opens at `from` months and ends at `to` months (the day
 * before when `open`, i.e. when the next dose's window starts). The window
 * drives Due now / Overdue. `hedisMinAgeDays` / `window` are the HEDIS
 * counting rules, which also give each dose its earliest allowed date.
 * `record` is the unspecified-brand vaccine written to patient_immunizations
 * when a dose is entered in the tracker. `measureCode` is the HEDIS CIS
 * indicator. Listed in the order the routine schedule starts them.
 */
export const CIS_ANTIGENS = [
  {
    key: 'hepb', measureCode: 'CISHEPB', label: 'Hep B', name: 'Hepatitis B', doses: 3,
    record: { title: 'Hep B', code: '45' },
    hedisMinAgeDays: 0,
    cvx: ['08', '45', '51', '110', '146'],
    match: /hep(atitis)?[\s-]*b\b|engerix|recombivax|pediarix|vaxelis/i,
    schedule: [{ from: 0, to: 1, open: true }, { from: 1, to: 2 }, { from: 6, to: 18 }],
  },
  {
    key: 'dtap', measureCode: 'CISDTP', label: 'DTaP', name: 'Diphtheria, tetanus, pertussis', doses: 4,
    record: { title: 'DTaP', code: '107' },
    hedisMinAgeDays: 42,
    cvx: ['20', '50', '106', '107', '110', '120', '130', '146'],
    match: /dtap|pediarix|pentacel|vaxelis|kinrix|quadracel|infanrix|daptacel/i,
    schedule: [{ from: 2, to: 4, open: true }, { from: 4, to: 6, open: true }, { from: 6, to: 15, open: true }, { from: 15, to: 18 }],
  },
  {
    key: 'ipv', measureCode: 'CISOPV', label: 'IPV', name: 'Polio', doses: 3,
    record: { title: 'IPV', code: '10' },
    hedisMinAgeDays: 42,
    cvx: ['10', '89', '110', '120', '130', '146'],
    match: /\bipv\b|polio|ipol|pediarix|pentacel|vaxelis|kinrix|quadracel/i,
    schedule: [{ from: 2, to: 4, open: true }, { from: 4, to: 6, open: true }, { from: 6, to: 18 }],
  },
  {
    key: 'hib', measureCode: 'CISHIB', label: 'HiB', name: 'Haemophilus influenzae type b', doses: 3,
    record: { title: 'Hib', code: '17' },
    hedisMinAgeDays: 42,
    cvx: ['17', '46', '47', '48', '49', '50', '51', '120', '146', '148'],
    match: /\bhib\b|pedvax|acthib|hiberix|pentacel|vaxelis/i,
    schedule: [{ from: 2, to: 4, open: true }, { from: 4, to: 12, open: true, label: '4 months' }, { from: 12, to: 15 }],
  },
  {
    key: 'pcv', measureCode: 'CISPNEU', label: 'PCV', name: 'Pneumococcal conjugate', doses: 4,
    record: { title: 'PCV', code: '152' },
    hedisMinAgeDays: 42,
    cvx: ['100', '133', '152', '215', '216'],
    match: /\bpcv|pneumococcal conjugate|prevnar|vaxneuvance/i,
    schedule: [{ from: 2, to: 4, open: true }, { from: 4, to: 6, open: true }, { from: 6, to: 12, open: true, label: '6 months' }, { from: 12, to: 15 }],
  },
  {
    key: 'rv', measureCode: 'CISROTA', label: 'Rotavirus', name: 'Rotavirus', doses: 3,
    record: { title: 'Rotavirus', code: '122' },
    hedisMinAgeDays: 42,
    cvx: ['116', '119', '122'],
    match: /rota/i,
    schedule: [{ from: 2, to: 4, open: true }, { from: 4, to: 6, open: true }, { from: 6, to: RV_MAX_AGE_MONTHS, label: '6 months' }],
  },
  {
    key: 'flu', measureCode: 'CISINFL', label: 'Influenza', name: 'Influenza', doses: 2,
    record: { title: 'Influenza', code: '88' },
    hedisMinAgeDays: 180,
    cvx: ['88', '111', '140', '141', '149', '150', '153', '155', '158', '161', '171', '186', '197', '205'],
    match: /influenza|\bflu|fluzone|fluarix|flulaval|afluria|flucelvax/i,
    // Dose 1 opens at 180 days; dose 2 opens 4 weeks after dose 1 (its date
    // given, else its window start) and runs to the 2nd birthday.
    schedule: [
      { from: 6, to: 7, open: true, fromDays: 180, label: '6 months (180 days)' },
      { from: 7, to: 24, afterPrevDays: 28, label: '4 weeks after Dose 1', short: '4 wk after Dose 1' },
    ],
  },
  {
    key: 'mmr', measureCode: 'CISMMR', label: 'MMR', name: 'Measles, mumps, rubella', doses: 1,
    record: { title: 'MMR', code: '03' },
    window: true,
    cvx: ['03', '94'],
    match: /\bmmr|proquad/i,
    schedule: [{ from: 12, to: 15 }],
  },
  {
    key: 'vzv', measureCode: 'CISVZV', label: 'VZV', name: 'Varicella (chickenpox)', doses: 1,
    record: { title: 'Varicella', code: '21' },
    window: true,
    cvx: ['21', '94'],
    match: /varicella|varivax|\bvzv\b|mmrv|proquad/i,
    schedule: [{ from: 12, to: 15 }],
  },
  {
    key: 'hepa', measureCode: 'CISHEPA', label: 'Hep A', name: 'Hepatitis A', doses: 1,
    record: { title: 'Hep A', code: '85' },
    window: true,
    cvx: ['31', '83', '85'],
    match: /hep(atitis)?[\s-]*a\b|havrix|vaqta/i,
    schedule: [{ from: 12, to: 23 }],
  },
];

// ── date helpers (local calendar days) ──
const DAY_MS = 86400000;
const toDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
const daysBetween = (later, earlier) => Math.round((toDay(later) - toDay(earlier)) / DAY_MS);
const maxDate = (...ds) => ds.filter(Boolean).reduce((a, b) => (b > a ? b : a));
const sameDay = (a, b) => daysBetween(a, b) === 0;
const normCvx = (code) => String(code ?? '').trim().replace(/^0+(?=\d)/, '');

/** Last month a schedule slot's window reaches, within the 2nd year. */
export const scheduleEndMonth = (slot) => Math.min(slot.open ? slot.to - 1 : slot.to, 23);

/** Whole months between `dob` and `on`. */
export function ageInMonths(dob, on) {
  let m = (on.getFullYear() - dob.getFullYear()) * 12 + (on.getMonth() - dob.getMonth());
  if (on.getDate() < dob.getDate()) m -= 1;
  return Math.max(0, m);
}

/** Antigen keys an immunization record counts toward (combo vaccines hit several). */
export function antigensForImmunization(imm) {
  const cvx = normCvx(imm?.code);
  const title = String(imm?.title || '');
  return CIS_ANTIGENS
    .filter(a => (cvx && a.cvx.map(normCvx).includes(cvx)) || a.match.test(title))
    .map(a => a.key);
}

const isRotarix = (dose) => ROTARIX_CVX.includes(normCvx(dose.code)) || ROTARIX_RE.test(dose.title);
const isLaiv = (dose) => LAIV_CVX.includes(normCvx(dose.code)) || LAIV_RE.test(dose.title);

const mdy = (d) => `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;

// Why a recorded dose does not count for HEDIS, or null when it does. Each
// reason names the date that decided it, e.g. "Given after the 2nd birthday
// (03/31/2026)". A dose that does not count takes its slot in the series
// (see evaluateAntigen), so the reason shows in place of a new dose row.
function invalidReason(antigen, dose, dob, firstBirthday, secondBirthday) {
  if (dose.date > secondBirthday) return { text: `Given after the 2nd birthday (${mdy(secondBirthday)})` };
  if (antigen.window && dose.date < firstBirthday) return { text: `Given before the 1st birthday (${mdy(firstBirthday)})` };
  const ageDays = daysBetween(dose.date, dob);
  if (ageDays < 0) return { text: `Dated before the date of birth (${mdy(dob)})` };
  if (antigen.hedisMinAgeDays && ageDays < antigen.hedisMinAgeDays) {
    const from = mdy(addDays(dob, antigen.hedisMinAgeDays));
    return { text: antigen.hedisMinAgeDays === 180 ? `Given before 6 months of age (${from})` : `Given before 42 days of age (${from})` };
  }
  if (antigen.key === 'flu' && isLaiv(dose) && !sameDay(dose.date, secondBirthday)) {
    return { text: `Nasal (LAIV) flu vaccine only counts on the 2nd birthday (${mdy(secondBirthday)})` };
  }
  return null;
}

const minDate = (...ds) => ds.filter(Boolean).reduce((a, b) => (b < a ? b : a));
// Doses whose window opens within this many days read as Upcoming.
const UPCOMING_DAYS = 30;

// ACIP recommended age, as the sheet words it: one age when the window runs
// up to the next dose, else the range.
function recommendedLabel(slot) {
  if (slot.label) return slot.label;
  if (slot.from === 0) return 'Birth (0 mo)';
  if (slot.open) return `${slot.from} months`;
  return `${slot.from}–${slot.to} months`;
}
function recommendedShort(slot) {
  if (slot.short) return slot.short;
  if (slot.open || slot.label) return `${slot.from} mo`;
  return `${slot.from}-${slot.to} mo`;
}

/**
 * Every dose of one antigen as display rows: recorded doses (counted or
 * not), doses marked given but not dated yet, then the planned doses still
 * needed. Each row carries the recommended age, earliest allowed date, the
 * routine start / due window and a status.
 *
 * @param {object} antigen    – CIS_ANTIGENS entry
 * @param {Array}  doses      – recorded doses ({ id, title, code, date }), date order
 * @param {number} pending    – doses marked given with no date yet
 * @param {number} [seriesDoses] – care team's series length (Rotavirus 2 or 3)
 */
function evaluateAntigen(antigen, doses, ctx, pending = 0, seriesDoses = null) {
  const { dob, today, firstBirthday, secondBirthday } = ctx;
  const valid = [];
  const invalid = [];
  const reasons = new Map();
  for (const dose of doses) {
    const reason = invalidReason(antigen, dose, dob, firstBirthday, secondBirthday)
      || (valid.some(v => sameDay(v.date, dose.date)) ? { text: `Same day as another dose (${mdy(dose.date)}), counted once` } : null);
    if (reason) {
      reasons.set(dose, reason);
      invalid.push({ ...dose, reason: reason.text });
    } else valid.push(dose);
  }
  // Rotavirus: a recorded RotaTeq (non-Rotarix) dose always needs 3. Otherwise
  // the care team's pick (seriesDoses) wins, then the brand on record.
  const rvNeedsThree = antigen.key === 'rv' && valid.some(d => !isRotarix(d));
  const required = antigen.key === 'rv'
    ? (rvNeedsThree ? 3 : seriesDoses ?? (valid.length > 0 ? 2 : 3))
    : antigen.doses;

  // Recommended window (sheet columns D / E) and HEDIS earliest allowed
  // date (column G) for the dose filling `slotIdx`. `prev` is the previous
  // dose's date given (else its window start); only flu dose 2 uses it.
  const slotMeta = (slotIdx, prev) => {
    const slot = antigen.schedule[Math.min(slotIdx, antigen.schedule.length - 1)];
    const start = slot.afterPrevDays && prev
      ? addDays(prev, slot.afterPrevDays)
      : slot.fromDays ? addDays(dob, slot.fromDays) : addMonths(dob, slot.from);
    const end = minDate(slot.open ? addDays(addMonths(dob, slot.to), -1) : addMonths(dob, slot.to), secondBirthday);
    const hedisEarliest = antigen.window ? firstBirthday : addDays(dob, antigen.hedisMinAgeDays ?? 0);
    // Flu dose 2 can't count until 4 weeks after dose 1 (sheet G32).
    const earliest = slot.afterPrevDays ? maxDate(hedisEarliest, start) : hedisEarliest;
    // `ageMonths` (age the window opens) drives the by-age view;
    // `ageEndMonths` is the last month it reaches, for the timeline.
    return {
      recommended: recommendedLabel(slot),
      recommendedShort: recommendedShort(slot),
      ageMonths: slot.from,
      ageEndMonths: scheduleEndMonth(slot),
      earliest,
      start,
      recommendedEnd: end,
      due: end,
    };
  };

  const rows = [];
  let validSeen = 0;
  let lateSlots = 0;
  let prevValid = null;
  for (const dose of doses) {
    const meta = slotMeta(validSeen + lateSlots, prevValid);
    const reason = reasons.get(dose);
    if (reason) {
      rows.push({ kind: 'given', record: dose, counts: false, reason: reason.text, status: CIS_DOSE_STATUS.notCounted, ...meta });
      // A dose that does not count still takes its slot: the list stays at
      // the series length and shows why, instead of opening a repeat dose.
      if (validSeen + lateSlots < required) lateSlots += 1;
    } else {
      const extra = validSeen >= required;
      // Given after the routine window but by the 2nd birthday: still
      // counts (catch-up), flagged so the team sees it was late.
      const late = !extra && dose.date > meta.due;
      rows.push({
        kind: 'given', record: dose, counts: true, extra,
        status: late ? CIS_DOSE_STATUS.completedLate : CIS_DOSE_STATUS.completed,
        reason: late ? `Given after the recommended window (ended ${mdy(meta.due)})` : undefined,
        ...meta,
      });
      validSeen += 1;
      prevValid = dose.date;
    }
  }
  let slotIdx = validSeen + lateSlots;
  for (let i = 0; i < pending && slotIdx < required; i++, slotIdx++) {
    rows.push({ kind: 'pending', counts: false, status: CIS_DOSE_STATUS.pending, ...slotMeta(slotIdx, prevValid) });
  }

  // Remaining doses: status comes from the recommended window only (opens at
  // `start`, Overdue after `due`); the earliest allowed date does not move it.
  const rvLastDay = antigen.key === 'rv' ? addMonths(dob, RV_MAX_AGE_MONTHS) : null;
  let prev = prevValid;
  let completion = valid.length >= required ? valid[required - 1].date : null;
  for (; slotIdx < required; slotIdx++) {
    const meta = slotMeta(slotIdx, prev);
    const planned = maxDate(meta.start, today);
    let status;
    if (planned > secondBirthday || (rvLastDay && planned > rvLastDay)) status = CIS_DOSE_STATUS.cannotMeet;
    else if (today > meta.due) status = CIS_DOSE_STATUS.overdue;
    else if (today >= meta.start) status = CIS_DOSE_STATUS.dueNow;
    else if (daysBetween(meta.start, today) <= UPCOMING_DAYS) status = CIS_DOSE_STATUS.upcoming;
    else status = CIS_DOSE_STATUS.onTrack;
    rows.push({ kind: 'planned', counts: false, status, plannedDate: planned, nextDue: meta.start, ...meta });
    prev = meta.start;
    completion = planned;
  }
  rows.forEach((r, i) => { r.number = i + 1; });

  const planned = rows.filter(r => r.kind === 'planned');
  const has = (st) => planned.some(r => r.status === st);
  let status;
  if (valid.length >= required) status = CIS_ANTIGEN_STATUS.met;
  // Short with nothing left to give (the open slots hold doses that do not
  // count), or a remaining dose can't fit before the 2nd birthday.
  else if (lateSlots > 0 || has(CIS_DOSE_STATUS.cannotMeet)) status = CIS_ANTIGEN_STATUS.cannotMeet;
  else if (has(CIS_DOSE_STATUS.overdue)) status = CIS_ANTIGEN_STATUS.overdue;
  else if (has(CIS_DOSE_STATUS.dueNow) || rows.some(r => r.kind === 'pending')) status = CIS_ANTIGEN_STATUS.dueNow;
  else if (has(CIS_DOSE_STATUS.upcoming)) status = CIS_ANTIGEN_STATUS.upcoming;
  else status = CIS_ANTIGEN_STATUS.onTrack;

  return {
    key: antigen.key,
    measureCode: antigen.measureCode,
    label: antigen.label,
    name: antigen.name,
    required,
    requiredLabel: String(required),
    seriesChoice: antigen.key === 'rv' ? { value: required, picked: !rvNeedsThree && seriesDoses != null, locked: rvNeedsThree } : null,
    valid,
    invalid,
    rows,
    status,
    nextDueDate: planned[0]?.nextDue ?? null,
    earliestCompletion: completion,
    blocker: status === CIS_ANTIGEN_STATUS.cannotMeet && antigen.key === 'rv'
      ? 'Rotavirus series cannot be finished by 8 months of age'
      : null,
  };
}

/**
 * Evaluate a child's CIS Combination 10 status.
 *
 * @param {object} args
 * @param {string|Date} args.dob              – member date of birth
 * @param {Array}  args.immunizations         – patient_immunizations rows
 *                                              ({ title, code, dateAdministered }).
 *                                              A row with no date and a
 *                                              `pendingFor` antigen key is a
 *                                              dose marked given, date to come.
 * @param {number} [args.measurementYear]     – defaults to today's year
 * @param {object} [args.seriesDoses]       – { rv: 2 | 3 } series length picked per vaccine
 * @param {Date}   [args.today]
 */
export function evaluateCis({ dob, immunizations = [], measurementYear, today = new Date(), seriesDoses = {} }) {
  const birth = parseLocalDate(dob);
  const now = toDay(today);
  const year = measurementYear || now.getFullYear();
  if (!birth) {
    return { evaluation: CIS_EVALUATION.notEligible, reason: 'Date of birth is missing, so the measure cannot be evaluated.', antigens: [], metCount: 0, total: CIS_ANTIGENS.length };
  }
  const dobDay = toDay(birth);
  const firstBirthday = addMonths(dobDay, 12);
  const secondBirthday = addMonths(dobDay, 24);
  const ctx = { dob: dobDay, today: now, firstBirthday, secondBirthday };

  const dosesByAntigen = Object.fromEntries(CIS_ANTIGENS.map(a => [a.key, []]));
  // Doses marked given in the tracker but not dated yet (`pendingFor`).
  const pendingByAntigen = Object.fromEntries(CIS_ANTIGENS.map(a => [a.key, 0]));
  for (const imm of immunizations) {
    const date = parseLocalDate(imm?.dateAdministered);
    if (!date) {
      if (imm?.pendingFor in pendingByAntigen) pendingByAntigen[imm.pendingFor] += 1;
      continue;
    }
    const dose = { id: imm.id, title: imm.title || '', code: imm.code || '', date: toDay(date) };
    for (const key of antigensForImmunization(imm)) dosesByAntigen[key].push(dose);
  }
  const antigens = CIS_ANTIGENS.map(a => evaluateAntigen(
    a,
    dosesByAntigen[a.key].sort((x, y) => x.date - y.date),
    ctx,
    pendingByAntigen[a.key],
    seriesDoses?.[a.key] ?? null,
  ));

  const allRows = antigens.flatMap(a => a.rows);
  const countOf = (st) => allRows.filter(r => r.status === st).length;
  const doses = {
    total: antigens.reduce((n, a) => n + a.required, 0),
    completed: antigens.reduce((n, a) => n + Math.min(a.valid.length, a.required), 0),
    dueNow: countOf(CIS_DOSE_STATUS.dueNow) + countOf(CIS_DOSE_STATUS.pending),
    overdue: countOf(CIS_DOSE_STATUS.overdue),
    upcoming: countOf(CIS_DOSE_STATUS.upcoming),
    onTrack: countOf(CIS_DOSE_STATUS.onTrack),
    cannotMeet: countOf(CIS_DOSE_STATUS.cannotMeet),
    notCounted: countOf(CIS_DOSE_STATUS.notCounted),
  };

  const metCount = antigens.filter(a => a.status === CIS_ANTIGEN_STATUS.met).length;
  const daysLeft = daysBetween(secondBirthday, now);
  const reportingYear = secondBirthday.getFullYear();
  const base = {
    dob: dobDay,
    firstBirthday,
    secondBirthday,
    ageMonths: ageInMonths(dobDay, now),
    daysLeft,
    reportingYear,
    antigens,
    doses,
    metCount,
    total: antigens.length,
  };

  if (reportingYear < year) {
    return { ...base, evaluation: CIS_EVALUATION.notEligible, reason: `Turned 2 in ${reportingYear}, before measurement year ${year}.` };
  }
  if (metCount === antigens.length) {
    return { ...base, evaluation: CIS_EVALUATION.compliant, reason: 'All 10 vaccines meet the Combination 10 requirements.' };
  }
  const blocked = antigens.filter(a => a.status === CIS_ANTIGEN_STATUS.cannotMeet);
  if (daysLeft < 0 || blocked.length) {
    const reason = daysLeft < 0
      ? 'The 2nd birthday has passed with vaccines outstanding. Later doses do not count for this measure.'
      : `${blocked.map(a => a.label).join(', ')} cannot be completed before the 2nd birthday.`;
    return { ...base, evaluation: CIS_EVALUATION.cannotMeet, reason };
  }
  const overdue = antigens.filter(a => a.status === CIS_ANTIGEN_STATUS.overdue);
  const outstanding = antigens.length - metCount;
  if (overdue.length || daysLeft <= AT_RISK_DAYS) {
    const reason = overdue.length
      ? `${overdue.map(a => a.label).join(', ')} ${overdue.length === 1 ? 'is' : 'are'} behind schedule. ${outstanding} of ${antigens.length} vaccines still outstanding.`
      : `${daysLeft} days left before the 2nd birthday with ${outstanding} vaccine${outstanding === 1 ? '' : 's'} outstanding.`;
    return { ...base, evaluation: CIS_EVALUATION.atRisk, reason };
  }
  return { ...base, evaluation: CIS_EVALUATION.onTrack, reason: `${metCount} of ${antigens.length} vaccines complete. Remaining doses fit before the 2nd birthday.` };
}

/**
 * Worklist countdown for a CIS-CMB10 gap: "Overdue by Nd" from the most
 * overdue dose, else "Due in Nd" to the nearest deadline of a dose that is
 * due now or opens within UPCOMING_DAYS. Null when nothing is pending.
 */
export function cisDueIndicator(result, today = new Date()) {
  const rows = (result?.antigens || []).flatMap(a => a.rows).filter(r => r.kind === 'planned');
  const overdue = rows.filter(r => r.status === CIS_DOSE_STATUS.overdue);
  if (overdue.length) {
    const days = Math.max(...overdue.map(r => daysBetween(today, r.due)));
    return { label: `Overdue by ${days}d`, tone: 'error' };
  }
  const due = rows.filter(r => r.status === CIS_DOSE_STATUS.dueNow || r.status === CIS_DOSE_STATUS.upcoming);
  if (!due.length) return null;
  const days = Math.min(...due.map(r => daysBetween(r.due, today)));
  return { label: days > 0 ? `Due in ${days}d` : 'Due today', tone: 'warning' };
}
