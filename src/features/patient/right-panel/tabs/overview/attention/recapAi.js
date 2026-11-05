import { apiFetch } from '../../../../../../lib/apiFetch';
import { kindMeta } from '../../timeline/streamKinds';
import { fmtDate } from './recapStory';

// Unity's per-section Recap summaries (api/_handlers/patient-recap-summary.js).
// The payload is the Recap's own computed facts (headlines, before → after
// rows, events, open items), so the model only puts them into words.

const EVENT_CAP = 20;

const toChange = r => ({ label: r.label, from: r.from ?? null, to: r.to, delta: r.delta ?? null, note: r.note ?? null });
const toEvent = e => ({
  date: fmtDate(e.at),
  type: kindMeta(e.kind).label,
  title: e.title,
  detail: e.detail || null,
  by: e.actor || null,
  outcome: e.outcome || null,
});
const toItem = s => ({ title: s.title, detail: s.detail, severity: s.severity });

/**
 * @param {object} args
 * @param {Array<{ key, title, headline, changes?, events?, items? }>} args.sections
 */
export function recapAiPayload({ patientName, period, sections }) {
  return {
    patientName: patientName || 'the patient',
    period,
    sections: sections.map(s => ({
      key: s.key,
      title: s.title,
      headline: s.headline,
      changes: (s.changes || []).map(toChange),
      events: (s.events || []).slice(0, EVENT_CAP).map(toEvent),
      items: (s.items || []).map(toItem),
    })),
  };
}

// Asks Unity to write the summaries. The store saves them
// (patient_recap_summaries), so this runs only on a first open or Refresh.
export async function writeRecapSummaries(payload) {
  const res = await apiFetch('/api/patient-recap-summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.summaries) throw new Error(json?.error?.message || 'Could not write the summary. Please try again.');
  return json.summaries;
}

const sentence = s => (s ? `${s.replace(/\.$/, '')}.` : '');
const joinList = (parts, word = 'and') => (parts.length <= 1 ? parts.join('')
  : `${parts.slice(0, -1).join(', ')} ${word} ${parts[parts.length - 1]}`);

/**
 * Sample summaries, one per section, composed from the same facts the AI
 * gets: shown when Unity can't answer, so every slide still reads as a
 * short paragraph. Nothing here goes beyond the recorded data.
 *
 * @param {object} args
 * @param {object} args.recap – buildRecap()
 * @param {object} args.changes – { touchpoints, clinical, vitals, medications, programs, attention }
 * @param {Array} args.signals – all attention signals
 * @param {Array} args.openSignals
 */
export function sampleSummaries({ recap, changes: ch, signals = [], openSignals = [] }) {
  const lastTouch = recap.lastTouch
    ? `The last visit was ${recap.lastTouch.title}${recap.lastTouch.actor ? ` with ${recap.lastTouch.actor}` : ''} on ${fmtDate(recap.lastTouch.at)}.`
    : 'There is no completed visit on record.';
  const top = openSignals[0];

  const completed = recap.touchpoints.find(e => /completed|attended/i.test(e.outcome || ''));
  const dropped = ch.touchpoints.rows.filter(r => r.key !== 'total' && r.key !== 'completed' && r.to === '0').map(r => r.label.toLowerCase());

  const worse = ch.vitals.rows.filter(r => r.tone === 'worse');
  const better = ch.vitals.rows.filter(r => r.tone === 'better');
  const hospital = signals.filter(s => s.kind === 'adt');

  const stopped = ch.medications.rows.filter(r => r.label === 'Stopped');
  const changedPrograms = ch.programs.rows.filter(r => r.note === 'Status changed' || r.note === 'Enrolled');
  const steadyPrograms = ch.programs.rows.filter(r => r.note === 'No change');

  return {
    glance: [
      lastTouch,
      sentence(ch.touchpoints.headline),
      worse.length ? `${joinList(worse.map(r => r.label))} moved further from goal.` : '',
      top ? `${openSignals.length} ${openSignals.length === 1 ? 'item needs' : 'items need'} attention, most urgent: ${top.title}.` : 'Nothing needs attention.',
    ].filter(Boolean).join(' '),
    touchpoints: [
      sentence(ch.touchpoints.headline),
      recap.touchpoints[0] ? `Most recent: ${recap.touchpoints[0].title}${recap.touchpoints[0].actor ? ` with ${recap.touchpoints[0].actor}` : ''} on ${fmtDate(recap.touchpoints[0].at)}.` : '',
      completed ? `The last completed contact was ${completed.title} on ${fmtDate(completed.at)}.` : 'None of them is marked completed.',
      dropped.length ? `No ${joinList(dropped, 'or')} this period.` : '',
    ].filter(Boolean).join(' '),
    clinical: [
      sentence(ch.clinical.headline),
      hospital[0] ? `${hospital[0].title} (${hospital[0].detail}).` : '',
      !recap.clinical.length && recap.earlierClinical[0]
        ? `The most recent record is ${recap.earlierClinical[0].title} on ${fmtDate(recap.earlierClinical[0].at)}.`
        : '',
    ].filter(Boolean).join(' '),
    vitals: [
      ...worse.map(r => `${r.label} went from ${r.from} to ${r.to}${r.delta ? ` (${r.delta})` : ''}, further from goal.`),
      better.length ? `${joinList(better.map(r => `${r.label} (${r.to})`))} moved closer to goal.` : '',
      !worse.length && !better.length ? sentence(ch.vitals.headline) : '',
    ].filter(Boolean).join(' '),
    medications: [
      sentence(ch.medications.headline),
      stopped.length ? `Stopped: ${joinList(stopped.map(r => `${r.to}${r.note ? ` (${r.note.split(' • ')[0]})` : ''}`))}.` : '',
    ].filter(Boolean).join(' '),
    programs: [
      changedPrograms.length
        ? `${joinList(changedPrograms.map(r => (r.from ? `${r.label} moved from ${r.from} to ${r.to}` : `${r.label} enrolled as ${r.to}`)))}.`
        : 'No program changed status in this period.',
      steadyPrograms.length ? `${joinList(steadyPrograms.map(r => `${r.label} stays ${r.to}`))}.` : '',
      recap.programs[0] ? `Latest update: ${recap.programs[0].title} on ${fmtDate(recap.programs[0].at)}.` : '',
    ].filter(Boolean).join(' '),
    attention: [
      sentence(ch.attention.headline),
      top ? `Start with ${top.title}${top.action ? ` (${top.action.label})` : ''}.` : '',
    ].filter(Boolean).join(' '),
  };
}
