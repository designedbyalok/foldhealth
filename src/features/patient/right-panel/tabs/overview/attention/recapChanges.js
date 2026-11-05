import { kindMeta } from '../../timeline/streamKinds';
import { goalTarget } from '../cards/vitalGoal';
import { fmtDate } from './recapStory';

/**
 * What changed in each Recap section: the period against what came before
 * it. Touchpoints and visits compare with the previous period of the same
 * length; a lab with its previous result; a vital's latest reading with the
 * one before it (and whether that moved it toward its goal); medications by
 * what was active at the start against now; programs by status before and
 * after. Every row comes from recorded data.
 *
 * Row: { key, label, from?, to, delta?, tone: 'better'|'worse'|'neutral', note? }
 * Section: { rows, headline }
 */

const fmtNum = n => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));
const signed = n => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${fmtNum(Math.abs(n))}`;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const joinList = parts => (parts.length <= 1 ? parts.join('')
  : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`);
const isEd = e => e.kind === 'adt' || (e.kind === 'encounter' && /emergency|\bED\b/i.test(e.title || ''));
const isHousekeeping = e => e.category === 'program' && /\b(downloaded|exported|viewed|printed)\b/i.test(e.title || '');
const between = (e, a, b) => e.at >= a && e.at < b;

/** The previous period of the same length, ending where this one starts. */
const previous = ({ from, now }) => ({ prevFrom: from - (now - from), from });

function countRow(key, label, before, after, { worseWhenUp = false } = {}) {
  const delta = after - before;
  const tone = !delta || !worseWhenUp ? 'neutral' : delta > 0 ? 'worse' : 'better';
  return { key, label, from: String(before), to: String(after), delta: delta ? signed(delta) : null, tone };
}

function trendWord(before, after, periodLabel) {
  if (after === before) return `the same as the previous ${periodLabel}`;
  return `${after > before ? 'up' : 'down'} from ${before} in the previous ${periodLabel}`;
}

export function touchpointChanges(events, window) {
  const { prevFrom, from } = previous(window);
  const isTouch = e => e.category === 'touchpoint' && e.at <= window.now;
  const cur = events.filter(e => isTouch(e) && e.at >= from);
  const prev = events.filter(e => isTouch(e) && between(e, prevFrom, from));
  const kinds = [...new Set([...cur, ...prev].map(e => e.kind))];
  const count = (list, kind) => list.filter(e => e.kind === kind).length;
  const completed = list => list.filter(e => /completed|attended/i.test(e.outcome || '')).length;
  const rows = [
    countRow('total', 'All touchpoints', prev.length, cur.length),
    ...kinds.map(k => countRow(k, kindMeta(k).label, count(prev, k), count(cur, k))).filter(r => r.from !== r.to),
  ];
  if (completed(cur) || completed(prev)) rows.push(countRow('completed', 'Completed', completed(prev), completed(cur)));
  return { rows, headline: `${plural(cur.length, 'touchpoint')}, ${trendWord(prev.length, cur.length, window.periodLabel)}.` };
}

export function clinicalChanges(events, window) {
  const { prevFrom, from } = previous(window);
  // Medication starts and stops have their own section.
  const past = events.filter(e => e.category === 'clinical' && e.kind !== 'med_start' && e.kind !== 'med_stop' && e.at <= window.now);
  const cur = past.filter(e => e.at >= from);
  const rows = [];

  cur.filter(e => e.kind === 'lab' && e.name && e.value != null).forEach((lab) => {
    const before = past.find(p => p.kind === 'lab' && p.name === lab.name && p.at < lab.at && p.value != null);
    const out = lab.outcome === 'Out of range';
    const unit = !lab.unit ? '' : lab.unit === '%' ? '%' : ` ${lab.unit}`;
    rows.push({
      key: `lab:${lab.id}`,
      label: lab.name,
      from: before ? `${fmtNum(before.value)}${unit}` : null,
      to: `${fmtNum(lab.value)}${unit}`,
      delta: before && lab.value !== before.value ? signed(lab.value - before.value) : null,
      tone: out ? 'worse' : before?.outcome === 'Out of range' ? 'better' : 'neutral',
      note: !before ? 'First result' : out ? 'Out of range' : before.outcome === 'Out of range' ? 'Back in range' : null,
    });
  });
  cur.filter(e => e.kind === 'diagnosis').forEach(d => rows.push({
    key: `dx:${d.id}`, label: 'New diagnosis', to: d.title.replace(/^(Diagnosis|Resolved): /, ''), tone: /^Resolved/.test(d.title) ? 'better' : 'neutral', note: fmtDate(d.at),
  }));

  const visits = list => list.filter(e => e.kind === 'encounter' && !isEd(e)).length;
  const ed = list => list.filter(isEd).length;
  const prev = past.filter(e => between(e, prevFrom, from));
  if (visits(cur) || visits(prev)) rows.push(countRow('visits', 'Visits', visits(prev), visits(cur)));
  if (ed(cur) || ed(prev)) rows.push(countRow('ed', 'ED visits', ed(prev), ed(cur), { worseWhenUp: true }));

  const labs = rows.filter(r => r.key.startsWith('lab:'));
  const worse = labs.filter(r => r.tone === 'worse').length;
  const diagnoses = rows.filter(r => r.key.startsWith('dx:')).length;
  const parts = [
    labs.length && `${plural(labs.length, 'new lab result')}${worse ? `, ${worse} out of range` : ''}`,
    diagnoses && plural(diagnoses, 'new diagnosis', 'new diagnoses'),
    ed(cur) && plural(ed(cur), 'ED visit'),
  ].filter(Boolean);
  let headline = 'No new clinical results or visits in this period.';
  if (cur.length) headline = `${parts.length ? parts.join(', ') : `${plural(cur.length, 'clinical record')} added`}.`;
  return { rows, headline };
}

export function vitalChanges(vitals) {
  const rows = (vitals || []).filter(v => Array.isArray(v.series) && v.series.length >= 2).map((v) => {
    const n = v.series.length;
    const prev = v.series[n - 2];
    const latest = v.series[n - 1];
    const dia = Array.isArray(v.diastolicSeries) && v.diastolicSeries.length === n ? v.diastolicSeries : null;
    const target = goalTarget(v.goalTo);
    let tone = 'neutral';
    let note = null;
    if (target != null && latest !== prev) {
      const closer = Math.abs(latest - target) < Math.abs(prev - target);
      tone = closer ? 'better' : 'worse';
      note = closer ? 'Closer to goal' : 'Further from goal';
    }
    if (v.tone === 'success') note = 'At goal';
    const unit = v.unit && v.unit !== '%' ? ` ${v.unit}` : v.unit || '';
    return {
      key: v.key,
      label: v.label,
      from: `${dia ? `${fmtNum(prev)}/${fmtNum(dia[n - 2])}` : fmtNum(prev)}${unit}`,
      to: `${v.value}${unit}`,
      delta: latest !== prev ? signed(latest - prev) : null,
      tone,
      note,
    };
  });
  const worse = rows.filter(r => r.tone === 'worse').map(r => r.label);
  const better = rows.filter(r => r.tone === 'better').map(r => r.label);
  const moves = [
    worse.length && `${joinList(worse)} moved further from goal`,
    better.length && `${joinList(better)} moved closer`,
  ].filter(Boolean);
  let headline = 'No readings to compare yet.';
  if (rows.length) headline = moves.length ? `${moves.join('; ')} since the previous reading.` : 'Readings held steady since the previous reading.';
  return { rows, headline };
}

const medName = e => (e.facts || []).find(f => f.label === 'Medication')?.value || e.title.replace(/^(Started|Stopped) /, '');
const medKey = e => e.id.replace(/-(start|stop)$/, '');

export function medicationChanges(events, window) {
  const { from, now } = window;
  const meds = new Map();
  events.filter(e => e.kind === 'med_start' || e.kind === 'med_stop').forEach((e) => {
    const m = meds.get(medKey(e)) || { name: medName(e) };
    if (e.kind === 'med_start') m.start = e.at; else { m.stop = e.at; m.reason = e.outcome; }
    meds.set(medKey(e), m);
  });
  const activeAt = t => [...meds.values()].filter(m => m.start != null && m.start <= t && (m.stop == null || m.stop > t)).length;
  const list = [...meds.values()];
  const started = list.filter(m => m.start >= from && m.start <= now);
  const stopped = list.filter(m => m.stop != null && m.stop >= from && m.stop <= now);
  const rows = [
    countRow('active', 'Active medications', activeAt(from), activeAt(now)),
    ...started.map(m => ({ key: `start:${m.name}`, label: 'Started', to: m.name, tone: 'neutral', note: fmtDate(m.start) })),
    ...stopped.map(m => ({ key: `stop:${m.name}`, label: 'Stopped', to: m.name, tone: 'neutral', note: [m.reason, fmtDate(m.stop)].filter(Boolean).join(' • ') })),
  ];
  const before = activeAt(from);
  const after = activeAt(now);
  const headline = !started.length && !stopped.length
    ? `No medication changes; ${plural(after, 'active medication')}.`
    : `${started.length} started, ${stopped.length} stopped; active medications ${before === after ? `stay at ${after}` : `went from ${before} to ${after}`}.`;
  return { rows, headline };
}

// "SNP Program Status Change", "AWV Program Enrolled": not "HRA Completed".
const isStatus = e => e.category === 'program' && e.outcome
  && /program (status change|enrolled|closed|completed|discontinued|paused|re-?enrolled)/i.test(e.title || '');

export function programChanges(events, window) {
  const { prevFrom, from } = previous(window);
  const past = events.filter(e => e.category === 'program' && e.at <= window.now && !isHousekeeping(e));
  const codes = [...new Set(past.filter(isStatus).map(e => e.program).filter(Boolean))];
  const rows = codes.map((code) => {
    const statuses = past.filter(e => isStatus(e) && e.program === code);
    const inPeriod = statuses.filter(e => e.at >= from);
    const after = inPeriod[0];
    const before = statuses.find(e => e.at < from);
    if (!after) return { key: code, label: code, from: before.outcome, to: before.outcome, tone: 'neutral', note: 'No change' };
    // First status inside the period: compare with the earliest one in it.
    const start = before || inPeriod[inPeriod.length - 1];
    const changed = start !== after && start.outcome !== after.outcome;
    return {
      key: code,
      label: code,
      from: changed ? start.outcome : null,
      to: after.outcome,
      tone: 'neutral',
      note: changed ? 'Status changed' : before ? 'Updated' : 'Enrolled',
    };
  });
  const cur = past.filter(e => e.at >= from);
  const prev = past.filter(e => between(e, prevFrom, from));
  rows.push(countRow('activity', 'Program activity', prev.length, cur.length));
  const changed = rows.filter(r => r.note === 'Status changed' || r.note === 'Enrolled');
  const headline = changed.length
    ? `${changed.map(r => `${r.label} ${r.from ? `${r.from} → ` : ''}${r.to}`).join('; ')}.`
    : `No program status changes; ${plural(cur.length, 'program activity', 'program activities')} recorded.`;
  return { rows, headline };
}

export function attentionChanges(signals, reviews, window) {
  const fresh = signals.filter(s => s.isNew && !reviews[s.id]).length;
  const open = signals.filter(s => !reviews[s.id]).length;
  const reviewedInPeriod = signals.filter((s) => {
    const r = reviews[s.id];
    return r && new Date(r.reviewedAt).getTime() >= window.from;
  }).length;
  const rows = [
    { key: 'new', label: 'New since last visit', to: String(fresh), tone: fresh ? 'worse' : 'neutral' },
    { key: 'reviewed', label: 'Reviewed in this period', to: String(reviewedInPeriod), tone: reviewedInPeriod ? 'better' : 'neutral' },
    { key: 'open', label: 'Still open', to: String(open), tone: 'neutral' },
  ];
  return { rows, headline: `${plural(open, 'open item')}, ${fresh} new since the last visit, ${reviewedInPeriod} reviewed in this period.` };
}
