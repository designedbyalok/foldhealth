import { lastTouchAt } from './attentionSignals';

/**
 * The Recap's story of a period: what happened with the patient, sorted
 * into touchpoints, clinical events, medication changes and program
 * updates, with the last touch, what is coming up, and a plain-language
 * summary. Built from the patient stream (data/patientStream.js); nothing
 * is inferred beyond counting and naming what the records hold.
 */

const DAY = 24 * 3600 * 1000;

export const RECAP_PERIODS = [
  { key: 'touch', label: 'Since last visit' },
  { key: '30', label: '30 days' },
  { key: '90', label: '90 days' },
];

export const fmtDate = ms => new Date(ms).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

/** { from, label } for a period key; "since last visit" falls back to 30 days. */
export function recapWindow(period, { events, now = Date.now() }) {
  if (period === 'touch') {
    const touch = lastTouchAt(events, now);
    if (touch != null) return { from: touch, label: `since the last visit on ${fmtDate(touch)}` };
  }
  const days = period === '90' ? 90 : 30;
  return { from: now - days * DAY, label: `in the last ${days} days` };
}

// Singular / plural nouns for the summary.
const NOUN = {
  call: ['call', 'calls'],
  chat: ['chat', 'chats'],
  email: ['email', 'emails'],
  sms: ['SMS', 'SMS messages'],
  efax: ['eFax', 'eFaxes'],
  visit: ['visit', 'visits'],
  assessment: ['assessment', 'assessments'],
  task: ['task', 'tasks'],
  appointment: ['appointment', 'appointments'],
  lab: ['lab result', 'lab results'],
  adt: ['hospital event', 'hospital events'],
  encounter: ['visit', 'visits'],
  diagnosis: ['diagnosis', 'diagnoses'],
  procedure: ['procedure', 'procedures'],
  immunization: ['immunization', 'immunizations'],
  note: ['clinical note', 'clinical notes'],
  device: ['device reading', 'device readings'],
  prom: ['patient-reported outcome', 'patient-reported outcomes'],
};
const noun = (kind, n) => {
  const [one, many] = NOUN[kind] || [kind, `${kind}s`];
  return `${n} ${n === 1 ? one : many}`;
};
const joinList = parts => (parts.length <= 1 ? parts.join('')
  : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Kinds in first-seen order with their counts. */
function countKinds(events) {
  const counts = new Map();
  events.forEach(e => counts.set(e.kind, (counts.get(e.kind) || 0) + 1));
  return [...counts].map(([kind, count]) => ({ kind, count }));
}

// Staff housekeeping on the program (a report downloaded or viewed) isn't
// something that happened with the patient.
const isHousekeeping = e => e.category === 'program' && /\b(downloaded|exported|viewed|printed)\b/i.test(e.title || '');

const isMedChange = e => e.kind === 'med_start' || e.kind === 'med_stop';

const isEd = e => e.kind === 'adt' || (e.kind === 'encounter' && /emergency|\bED\b/i.test(e.title || ''));

/**
 * @param {object} args
 * @param {Array} args.events – the patient stream, newest first
 * @param {number} args.from – window start (ms)
 * @param {number} [args.now]
 * @param {number} [args.openCount] – open attention signals, for the summary
 */
export function buildRecap({ events = [], from, now = Date.now(), openCount = 0 }) {
  const past = events.filter(e => e.at <= now && !isHousekeeping(e));
  const inWindow = past.filter(e => e.at >= from);
  const touchpoints = inWindow.filter(e => e.category === 'touchpoint');
  const medications = inWindow.filter(isMedChange);
  const clinical = inWindow.filter(e => e.category === 'clinical' && !isMedChange(e));
  const programs = inWindow.filter(e => e.category === 'program');
  // With nothing new, the clinical step still shows where things stand.
  const earlierClinical = clinical.length ? [] : past
    .filter(e => e.category === 'clinical' && !isMedChange(e) && e.at < from)
    .slice(0, 3);
  const upcoming = events.filter(e => e.at > now && e.kind === 'appointment').sort((a, b) => a.at - b.at).slice(0, 3);
  const touchAt = lastTouchAt(events, now);
  const lastTouch = touchAt != null ? events.find(e => e.at === touchAt && e.category === 'touchpoint') : null;

  const channels = countKinds(touchpoints);
  const clinicalKinds = countKinds(clinical);
  const outOfRange = clinical.filter(e => e.kind === 'lab' && e.outcome === 'Out of range').length;
  const ed = clinical.filter(isEd);
  const started = medications.filter(e => e.kind === 'med_start').length;
  const stopped = medications.length - started;

  const summary = [];
  if (lastTouch) {
    summary.push(`Last visit: ${lastTouch.title}${lastTouch.actor ? ` with ${lastTouch.actor}` : ''} on ${fmtDate(lastTouch.at)}.`);
  }
  if (touchpoints.length) {
    summary.push(`${plural(touchpoints.length, 'touchpoint')}: ${joinList(channels.map(c => noun(c.kind, c.count)))}.`);
  }
  if (clinical.length) {
    const extra = [outOfRange && `${outOfRange} out of range`, ed.length && plural(ed.length, 'ED visit')].filter(Boolean);
    summary.push(`${joinList(clinicalKinds.map(c => noun(c.kind, c.count)))} recorded${extra.length ? `, ${joinList(extra)}` : ''}.`);
  }
  if (medications.length) {
    summary.push(`${plural(medications.length, 'medication change')}: ${joinList([started && `${started} started`, stopped && `${stopped} stopped`].filter(Boolean))}.`);
  }
  if (programs.length) {
    const latest = programs[0];
    summary.push(`${plural(programs.length, 'program update')}, latest ${latest.title}${latest.outcome ? ` (${latest.outcome})` : ''} on ${fmtDate(latest.at)}.`);
  }
  if (!inWindow.length) summary.push('Nothing was recorded in this period.');
  if (openCount) summary.push(`${plural(openCount, 'item')} ${openCount === 1 ? 'needs' : 'need'} attention.`);

  return {
    from,
    inWindow,
    touchpoints,
    clinical,
    earlierClinical,
    medications,
    programs,
    upcoming,
    lastTouch,
    channels,
    counts: { touchpoints: touchpoints.length, clinical: clinical.length, medications: medications.length, programs: programs.length },
    summary,
  };
}
