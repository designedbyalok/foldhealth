import { useMemo, useState } from 'react';
import { ActivityLog } from '../../../components/ActivityLog/ActivityLog';
import { Drawer } from '../../../components/Drawer/Drawer';
import { FilterChip } from '../../../components/FilterChip/FilterChip';
import { DateRangeFilter } from '../../../components/DateRangeFilter/DateRangeFilter';
import { inDatePreset } from '../../../components/DateRangeFilter/dateRangePresets';
import { Link } from '../../../components/Link/Link';
import { toActivityLogEntries } from '../../hedis-worklist/CareGapDetailDrawer.utils';
import { usePharmacyProgramMember } from './usePharmacyProgramMember';
import { barrierHistoryEntries } from './barrierHistory';
import { VERIFICATION_TITLE, withBullets, withVerificationDetails } from './verificationHistory';
import styles from './PharmacyActivityLog.module.css';

// Barrier & intervention changes come from the barrier log, in the History
// entry layout (one per gap, what changed, View Details); their one-line
// activity copies are left out.
const BARRIER_ACTIVITY = /^(Barriers & interventions|Barrier resolved|Intervention done|Intervention didn't work)/;
const GAP_CODES = /\b(MAD|MAH|MAC)\b/g;

// What kind of activity an entry is, for the Activity Type filter.
function activityType(e) {
  if (e.line) return 'Barrier & intervention';
  const title = e.title || '';
  if (VERIFICATION_TITLE.test(title)) return 'Assessment';
  if (e.t === 'outreach') return 'Outreach';
  if (e.t === 'call') return 'Call';
  if (e.t === 'comment') return 'Comment';
  if (e.t === 'assignee_change') return 'Assignment';
  if (e.t === 'status_change') return 'Status change';
  if (e.t === 'system') return 'Rework task';
  if (/recent fill/i.test(title)) return 'Fill update';
  if (/^Medication updated/.test(title)) return 'Medication update';
  return 'Other';
}

// Everything done on a pharmacy member (outreach, verification calls,
// pickups and the fill dates they moved, barrier logs, medication edits,
// status and assignee changes), newest first, grouped by month, with
// filters for type, date, who, medication and gap.
// `onViewVerification(call)`: View details on a saved verification call opens
// that call's form (read-only) instead of expanding the answers inline.
// `onAddToOutreach(call)`: an assessment entry's "Add to outreach note" puts
// its summary in the outreach note.
export function PharmacyActivityLog({ member, onViewVerification, onAddToOutreach }) {
  const [types, setTypes] = useState([]);
  const [datePreset, setDatePreset] = useState(null);
  const [dateRange, setDateRange] = useState([]);
  const [people, setPeople] = useState([]);
  const [meds, setMeds] = useState([]);
  const [gaps, setGaps] = useState([]);

  const drugsByGap = useMemo(() => Object.fromEntries((member?.measures || []).map(x => [x.code, x.medications.map(d => d.name)])), [member]);

  // Every entry tagged with its type, who, gaps and drugs, for the filters.
  const all = useMemo(() => {
    const activity = (member?.activityLog || [])
      .filter(e => !BARRIER_ACTIVITY.test(e.title || ''))
      .map(withVerificationDetails)
      .map(e => {
        // Every saved assessment, old (answers) and new (picks), has its form.
        const call = e.verificationId
          ? (member.callHistory || []).find(c => c.id === e.verificationId && c.kind === 'pharmacy-verification')
          : null;
        return {
          ...e, when: e.at, title: withBullets(e.title), note: withBullets(e.note), outcome: withBullets(e.outcome),
          ...(call && onViewVerification ? { onViewDetails: () => onViewVerification(call) } : {}),
          ...(call && onAddToOutreach ? { extraAction: { label: 'Add to outreach note', onClick: () => onAddToOutreach(call) } } : {}),
        };
      });
    const barriers = member ? barrierHistoryEntries(member, member.measures || []) : [];
    const allDrugs = [...new Set(Object.values(drugsByGap).flat())];
    return [...activity, ...barriers].map(e => {
      const text = `${e.title || ''} ${e.note || ''} ${(e.details || []).map(d => d.label).join(' ')}`;
      const codes = e.line ? [e.line.code] : [...new Set(text.match(GAP_CODES) || [])];
      // A barrier line names its drug, or covers every drug of its gap.
      const drugs = e.line
        ? (e.line.medication ? allDrugs.filter(n => e.line.medication.startsWith(n)) : drugsByGap[e.line.code] || [])
        : allDrugs.filter(n => text.includes(n));
      return { ...e, type: activityType(e), person: e.actor || e.user || 'System', codes, drugs };
    });
  }, [member, drugsByGap, onViewVerification, onAddToOutreach]);

  const options = useMemo(() => ({
    types: [...new Set(all.map(e => e.type))].sort(),
    people: [...new Set(all.map(e => e.person))].sort(),
    meds: [...new Set(Object.values(drugsByGap).flat())].sort(),
    gaps: Object.keys(drugsByGap),
  }), [all, drugsByGap]);

  const filtered = types.length || people.length || meds.length || gaps.length || datePreset;
  const entries = useMemo(() => {
    const inRange = inDatePreset(datePreset, dateRange);
    const kept = all.filter(e => (!types.length || types.includes(e.type))
      && (!people.length || people.includes(e.person))
      && (!meds.length || e.drugs.some(d => meds.includes(d)))
      && (!gaps.length || e.codes.some(c => gaps.includes(c)))
      && inRange(e.when));
    return toActivityLogEntries(kept).map(e => (e.dateOnly ? { ...e, time: '' } : e));
  }, [all, types, people, meds, gaps, datePreset, dateRange]);
  const clearAll = () => { setTypes([]); setPeople([]); setMeds([]); setGaps([]); setDatePreset(null); setDateRange([]); };

  return (
    <div className={styles.wrap}>
      <div className={styles.filters}>
        <FilterChip label="Activity Type" searchable options={options.types} selected={types} onChange={setTypes} />
        <DateRangeFilter label="Date" preset={datePreset} range={dateRange} onChange={(preset, range) => { setDatePreset(preset); setDateRange(range); }} />
        <FilterChip label="By" searchable options={options.people} selected={people} onChange={setPeople} />
        <FilterChip label="Medication" searchable options={options.meds} selected={meds} onChange={setMeds} />
        <FilterChip label="Gap" options={options.gaps} selected={gaps} onChange={setGaps} />
        {filtered ? <Link variant="secondary" onClick={clearAll}>Clear All</Link> : null}
      </div>
      <ActivityLog
        entries={entries}
        relaxed
        flushTop
        emptyLabel={filtered ? 'No activity matches these filters.' : 'No activity recorded yet.'}
      />
    </div>
  );
}

// Activity Log step of the Pharmacy program.
export function PharmacyActivityLogStep() {
  const member = usePharmacyProgramMember();
  return <PharmacyActivityLog member={member} />;
}

// Worklist row → "Activity Log".
export function PharmacyActivityDrawer({ member, onClose }) {
  return (
    <Drawer title={`Activity Log · ${member.name}`} onClose={onClose} width={560}>
      <PharmacyActivityLog member={member} />
    </Drawer>
  );
}
