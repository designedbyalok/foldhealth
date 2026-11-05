/**
 * Extra sections a care plan print can carry (Personalize > Content): labs
 * from the plan's lab goals, active medications, and medical / surgical /
 * family history. Each section is { title, cols: [{ label, w }], rows, empty }
 * with `w` a fraction of the page width, so either PDF layout can draw it.
 * Missing values print as "Not recorded"; nothing is filled in.
 */
import { normalizeCategory } from '../../../../../../settings/care-plan-library/lib/goalCategories';
import { formatGoalTarget } from '../../../../../../settings/care-plan-library/lib/goalFormat';

const NOT_RECORDED = 'Not recorded';

function fmtDate(value) {
  if (!value) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (m) return `${m[2]}/${m[3]}/${m[1]}`;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

/** The latest reading on each lab goal (A1C, LDL, eGFR...), with its target. */
export function labSection(goals, measurements) {
  const labGoals = (goals || []).filter(g => normalizeCategory(g.category) === 'Labs');
  const rows = labGoals.map((g) => {
    const latest = (measurements || [])
      .filter(m => String(m.goalId) === String(g.id) && m.value)
      .sort((a, b) => new Date(b.takenAt) - new Date(a.takenAt))[0];
    return [
      { title: g.measure || g.title, sub: g.measure ? g.title : '' },
      latest ? [latest.value, latest.unit].filter(Boolean).join(' ') : NOT_RECORDED,
      latest ? fmtDate(latest.takenAt) : '',
      formatGoalTarget(g) || '',
      latest ? (latest.favorable ? 'In target' : 'Out of target') : '',
    ];
  });
  return {
    title: 'Labs',
    cols: [{ label: 'Test', w: 0.34 }, { label: 'Result', w: 0.16 }, { label: 'Date', w: 0.14 }, { label: 'Target', w: 0.2 }, { label: '', w: 0.16 }],
    rows,
    empty: 'No lab goals on this care plan.',
  };
}

/** Active medications with their directions. */
export function medicationSection(medications) {
  const active = (medications || []).filter(m => !m.status || /^active$/i.test(m.status));
  return {
    title: 'Medications',
    cols: [{ label: 'Medication', w: 0.42 }, { label: 'Directions', w: 0.42 }, { label: 'Start', w: 0.16 }],
    rows: active.map(m => [{ title: m.name }, m.sig || NOT_RECORDED, fmtDate(m.start)]),
    empty: 'No active medications on record.',
  };
}

const HISTORY_KINDS = [['medical', 'Medical'], ['surgical', 'Surgical'], ['family', 'Family']];

/** Medical, surgical and family history from PAMI/Hx. */
export function historySection(history) {
  const rank = Object.fromEntries(HISTORY_KINDS.map(([k], i) => [k, i]));
  const label = Object.fromEntries(HISTORY_KINDS);
  const rows = (history || [])
    .filter(h => h.kind in rank)
    .sort((a, b) => rank[a.kind] - rank[b.kind])
    .map(h => [
      { title: h.title, sub: h.detail },
      label[h.kind],
      h.kind === 'family' ? (h.relation || NOT_RECORDED) : (fmtDate(h.recordedOn) || NOT_RECORDED),
    ]);
  return {
    title: 'History',
    cols: [{ label: 'Condition or procedure', w: 0.5 }, { label: 'Type', w: 0.2 }, { label: 'Relation or date', w: 0.3 }],
    rows,
    empty: 'No medical, surgical or family history on record.',
  };
}

/** The sections a print asked for, in the order they print. */
export function printContentSections({ labs = null, medications = null, history = null }) {
  return [labs, medications, history].filter(Boolean);
}
