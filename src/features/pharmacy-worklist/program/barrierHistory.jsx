import { toActivityLogEntries } from '../../hedis-worklist/CareGapDetailDrawer.utils';
import { MEASURE_ORDER } from '../pharmacyWorklist.utils';
import { BARRIER_ICON, INTERVENTION_ICON } from '../adherencePicklists';
import { LOG_TYPE_ICON } from '../../patient/left-panel/tabs/outreach/OutreachTab/OutreachTab.utils';
import { EntryBody } from './BarrierHistoryEntry';

// Barrier & intervention History entries, shared by the Barriers &
// Interventions tab, a drug's detail panel and the Activity tab, so a change
// reads the same wherever it shows.

// Results aren't shown here; a gap whose record only set one is left out.
export const hasBarrierData = (r) => r && (r.barriers.length > 0 || r.interventions.length > 0 || !r.result);

// The rail icon for one History line: what happened (resolved or done,
// didn't work), else where it came from (the outreach's own type, a
// medication edit), else what it added (a barrier, or only interventions).
function railFor(e, line) {
  if (line.completed?.outcome === "Didn't work") return { icon: 'solar:close-circle-linear', avatarVariant: 'error' };
  if (line.completed || line.resolvedList) return { icon: 'solar:check-circle-linear', avatarVariant: 'success' };
  if (e.source === 'Outreach') {
    return { icon: LOG_TYPE_ICON[e.outreachType]?.icon || (e.outreachType === 'SMS' ? 'solar:chat-square-linear' : 'solar:phone-calling-linear'), avatarVariant: 'others' };
  }
  if (e.source === 'Medication review') return { icon: 'solar:pill-linear', avatarVariant: 'others' };
  return line.addB?.length || line.remB?.length
    ? { icon: BARRIER_ICON, avatarVariant: 'error' }
    : { icon: INTERVENTION_ICON, avatarVariant: 'others' };
}

const minus = (a, b) => a.filter(v => !b.includes(v));
const EMPTY_LISTS = { barriers: [], interventions: [] };

// History for the shared timeline: one entry per gap an entry touched (per
// drug when the gap was set per medication), each showing only what changed
// against that gap's or drug's previous record. `keep(line)` narrows them
// (one drug's view keeps its own lines and the gap-wide ones).
export function barrierHistoryEntries(member, measures, keep = () => true) {
  const byCode = Object.fromEntries(measures.map(x => [x.code, x]));
  const state = {}; // code → { gap, meds: { id → lists } }, oldest first
  const out = [];
  for (const e of [...(member.interventionLog || [])].reverse()) {
    const lines = [];
    const tag = (code, medication, medId) => ({
      code, medication, medId,
      target: medication || `all ${code} medications`,
    });
    // Resolutions and outcomes: one line per gap and drug.
    if (e.completed || e.resolved) {
      const groups = new Map();
      for (const c of e.completed || []) groups.set(`${c.code}|${c.medication || ''}`, { ...tag(c.code, c.medication), completed: c });
      for (const r of e.resolved || []) {
        const k = `${r.code}|${r.medication || ''}`;
        const g = groups.get(k) || tag(r.code, r.medication);
        g.resolvedList = [...(g.resolvedList || []), r.barrier];
        groups.set(k, g);
      }
      lines.push(...groups.values());
    }
    for (const [code, rec] of Object.entries(e.measures || {}).toSorted(([a], [b]) => MEASURE_ORDER.indexOf(a) - MEASURE_ORDER.indexOf(b))) {
      if (!byCode[code] || !hasBarrierData(rec)) continue;
      const st = state[code] || (state[code] = { gap: EMPTY_LISTS, meds: {} });
      const diff = (prev, next) => ({
        addB: minus(next.barriers, prev.barriers), addI: minus(next.interventions, prev.interventions),
        remB: minus(prev.barriers, next.barriers), remI: minus(prev.interventions, next.interventions),
      });
      if (rec.medications) {
        for (const d of rec.medications) {
          const prev = st.meds[d.id] || st.gap;
          if (!e.completed && !e.resolved) lines.push({ ...tag(code, d.name, d.id), rec: d, ...diff(prev, d) });
          st.meds[d.id] = d;
        }
      } else {
        if (!e.completed && !e.resolved) lines.push({ ...tag(code, e.medication), rec, ...diff(st.gap, rec) });
        st.meds = {};
      }
      st.gap = rec;
    }
    const way = e.source || (e.completed || e.resolved ? 'Barriers & Interventions' : 'Update Barriers');
    for (const line of lines.filter(l => byCode[l.code]).filter(keep)) {
      // `at` (a full timestamp) on newer entries; older ones have a date only.
      out.push({
        t: 'note', when: e.at || e.date, dateOnly: !e.at, actor: e.by, note: e.note,
        context: `${way} • ${line.code}`, ...railFor(e, line), line,
        render: (entry) => <EntryBody entry={entry} />,
      });
    }
  }
  return out.reverse();
}

// The same entries, month-grouped for the shared timeline.
export function buildBarrierHistory(member, measures, keep) {
  return toActivityLogEntries(barrierHistoryEntries(member, measures, keep))
    .map(x => (x.t === 'group' || !x.dateOnly ? x : { ...x, time: '' }));
}
