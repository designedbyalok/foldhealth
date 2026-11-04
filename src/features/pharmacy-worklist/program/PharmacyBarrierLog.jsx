import { useMemo, useState } from 'react';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { ActivityLog } from '../../../components/ActivityLog/ActivityLog';
import { Badge } from '../../../components/Badge/Badge';
import { Button } from '../../../components/Button/Button';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { DashboardCard } from '../../../components/DashboardCard/DashboardCard';
import { EmptyState } from '../../../components/EmptyState/EmptyState';
import { DownChevronIcon } from '../../../components/Icon/DownChevronIcon';
import { Select } from '../../../components/Select/Select';
import { SubTabs } from '../../../components/SubTabs/SubTabs';
import { Textarea } from '../../../components/Textarea/Textarea';
import { useAppStore } from '../../../store/useAppStore';
import { toast } from '../../../components/Toast/sonnerToast';
import { MEASURE_NAMES, MEASURE_ORDER, medLabel, todayMdy } from '../pharmacyWorklist.utils';
import { Sep } from '../PharmacyCells';
import { BARRIERS, INTERVENTIONS, INTERVENTION_ADDRESSES } from '../adherencePicklists';
import { buildBarrierHistory, hasBarrierData } from './barrierHistory';
import { latestFor, recordWithMedAdditions } from './useBarrierForm';
import styles from './PharmacyBarrierLog.module.css';

// An active barrier with its Resolve button beside it.
// `since` (optional) maps an item to the date it was first logged, shown in
// brackets after it.
const Since = ({ date }) => (date ? <span className={styles.since}>({date})</span> : null);

const BarrierChips = ({ items, onResolve, context, since }) => (items.length ? (
  <span className={styles.chips}>
    {items.map(v => (
      <span key={v} className={styles.resolvable}>
        <Badge size="sm" tone="danger" label={v} />
        <Since date={since?.[v]} />
        <ActionButton size="sm" icon="solar:check-circle-linear" tooltip={`Mark ${v} resolved`} aria-label={`Mark ${v} resolved for ${context}`} onClick={() => onResolve(v)} />
        {/* Holds the place of an intervention's ✕ so every ✓ lines up. */}
        <span className={styles.actionSlot} aria-hidden="true" />
      </span>
    ))}
  </span>
) : <span className={styles.none}>None</span>);

// An active intervention with Done and Didn't work beside it.
const InterventionChips = ({ items, context, onFinish, since }) => (
  <span className={styles.chips}>
    {items.map(v => (
      <span key={v} className={styles.resolvable}>
        <Badge size="sm" label={v} />
        <Since date={since?.[v]} />
        <ActionButton size="sm" icon="solar:check-circle-linear" tooltip={`Mark ${v} done`} aria-label={`Mark ${v} done for ${context}`} onClick={() => onFinish(v, 'Done')} />
        <ActionButton size="sm" icon="solar:close-circle-linear" tooltip={`${v} didn't work`} aria-label={`Mark ${v} didn't work for ${context}`} onClick={() => onFinish(v, "Didn't work")} />
      </span>
    ))}
  </span>
);

// One drug: its name, then its Barriers and Interventions on labelled lines
// (a line with nothing on it is left out).
const DrugBlock = ({ name, barriers, interventions, onResolve, onFinish }) => (
  <div className={styles.drugBlock}>
    <span className={styles.drugName}>{name}</span>
    <div className={styles.current}>
      {barriers.length > 0 && <><span className={styles.label}>Barriers</span><BarrierChips items={barriers} context={name} onResolve={onResolve} /></>}
      {interventions.length > 0 && <><span className={styles.label}>Interventions</span><InterventionChips items={interventions} context={name} onFinish={onFinish} /></>}
      {!barriers.length && !interventions.length && <span className={styles.none}>None</span>}
    </div>
  </div>
);

// Resolve a barrier, or mark an intervention Done / Didn't work, with a
// toast; Done on an intervention that addresses a barrier still standing in
// the same place asks whether to resolve that barrier too. `prompt` is that
// dialog, for the caller to render.
function useBarrierActions(memberId) {
  const resolveBarrier = useAppStore(s => s.resolvePharmacyBarrier);
  const completeIntervention = useAppStore(s => s.completePharmacyIntervention);
  const [ask, setAsk] = useState(null);
  const resolve = (code, barrier, med) => {
    resolveBarrier(memberId, { code, barrier, medId: med?.id || null });
    toast.success(`Resolved ${barrier} on ${code}${med ? ` · ${med.name}` : ''}`);
  };
  const finish = ({ code, intervention, outcome, med, resolveToo = [] }) => {
    completeIntervention(memberId, { code, intervention, outcome, medId: med?.id || null, resolve: resolveToo });
    const where = `${code}${med ? ` · ${med.name}` : ''}`;
    if (outcome === 'Done') toast.success(`${intervention} done on ${where}${resolveToo.length ? `; resolved ${resolveToo.join(', ')}` : ''}`);
    else toast(`${intervention} marked didn't work on ${where}`);
  };
  const onFinish = (code, med, standing) => (intervention, outcome) => {
    const addressed = outcome === 'Done' ? (INTERVENTION_ADDRESSES[intervention] || []).filter(b => standing.includes(b)) : [];
    if (addressed.length) setAsk({ code, intervention, med, addressed });
    else finish({ code, intervention, outcome, med });
  };
  const prompt = ask && (
    <ConfirmDialog
      variant="primary"
      icon="solar:check-circle-linear"
      iconColor="var(--status-success)"
      title={`Also resolve ${ask.addressed.join(', ')}?`}
      description={`${ask.intervention} addresses ${ask.addressed.join(', ')} on ${ask.code}${ask.med ? ` · ${ask.med.name}` : ''}. Resolve it now, or keep it active if the member still faces it.`}
      confirmLabel="Resolve too"
      cancelLabel="Just mark done"
      onConfirm={() => { finish({ ...ask, outcome: 'Done', resolveToo: ask.addressed }); setAsk(null); }}
      onCancel={() => { finish({ ...ask, outcome: 'Done' }); setAsk(null); }}
      onClose={() => setAsk(null)}
    />
  );
  return { resolve, onFinish, prompt };
}

// When each item has stood since: walking back from the newest entry for the
// gap, the date of the oldest entry in the unbroken run that still lists it.
// `listOf(rec)` picks the list to read (a drug's own, else the gap's).
function sinceDates(log, code, items, listOf) {
  const out = {};
  for (const v of items) {
    for (const e of log || []) {
      const rec = e.measures?.[code];
      if (!rec || !hasBarrierData(rec)) continue;
      if (!listOf(rec).includes(v)) break;
      out[v] = e.date;
    }
  }
  return out;
}

// Read-only Barriers & Interventions for the gap drawer. Active Barriers: per
// gap, what stands now (its newest entry) and which drugs carry a barrier.
// History: every entry across the gaps in one timeline. Here a barrier is
// resolved and an intervention marked Done or Didn't work; anything else
// changes through Update Barriers (`onEdit`) or an outreach. A gap with
// nothing logged at gap level shows only its drugs.
export function PharmacyBarrierLog({ member, onEdit }) {
  const [view, setView] = useState('active');
  const { resolve, onFinish, prompt } = useBarrierActions(member.id);

  const measures = useMemo(() => (member?.measures || [])
    .toSorted((a, b) => MEASURE_ORDER.indexOf(a.code) - MEASURE_ORDER.indexOf(b.code)), [member]);

  const active = useMemo(() => measures.map(x => {
    const latest = (member.interventionLog || []).find(e => hasBarrierData(e.measures?.[x.code]));
    const current = latest?.measures[x.code];
    // Logged for the whole gap, a barrier is every drug's reason too; only a
    // drug whose reason differs gets its own block.
    // An entry made from one drug (a Medication Review edit) isn't gap-wide.
    const gapLevel = current && !current.medications && !latest.medication && (current.barriers.length > 0 || current.interventions.length > 0);
    const drugBarriers = x.medications.filter(d => d.status !== 'Discontinued' && d.nonAdherenceReason
      && !(gapLevel && current.barriers.includes(d.nonAdherenceReason)));
    return { x, latest, current, gapLevel, drugBarriers };
  }).filter(g => g.current?.barriers.length || g.current?.interventions.length || g.drugBarriers.length), [measures, member]);

  const history = useMemo(() => buildBarrierHistory(member, measures), [measures, member]);

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <SubTabs
          tabs={[{ key: 'active', label: 'Active' }, { key: 'history', label: 'History' }]}
          value={view}
          onValueChange={setView}
          size="sm"
        />
        {onEdit && view === 'active' && <Button variant="ghost" size="sm" leadingIcon="solar:pen-linear" onClick={onEdit}>Edit</Button>}
      </div>

      {view === 'active' && (active.length === 0 ? (
        <EmptyState
          icon="solar:clipboard-list-linear"
          title="No active barriers"
          description="Barriers and interventions show here once logged from an outreach or with Update Barriers."
        />
      ) : active.map(({ x, latest, current, gapLevel, drugBarriers }) => (
        <DashboardCard
          key={x.code}
          size="S"
          title={(
            <span className={styles.titleStack}>
              {`${x.code} (${MEASURE_NAMES[x.code] || x.code})`}
              {(gapLevel || latest) && (
                <span className={styles.titleSub}>
                  {gapLevel && 'Applies to all medications'}
                  {gapLevel && latest && <Sep />}
                  {latest && `Last logged ${latest.date}`}
                </span>
              )}
            </span>
          )}
        >
          {current?.medications ? (
            <div className={styles.drugs}>
              {current.medications.map(d => (
                <DrugBlock
                  key={d.id}
                  name={d.name}
                  barriers={d.barriers}
                  interventions={d.interventions}
                  onResolve={v => resolve(x.code, v, d)}
                  onFinish={onFinish(x.code, d, [...d.barriers, x.medications.find(m => m.id === d.id)?.nonAdherenceReason].filter(Boolean))}
                />
              ))}
            </div>
          ) : (current?.barriers.length > 0 || current?.interventions.length > 0) && (
            <div className={styles.current}>
              {current.barriers.length > 0 && <>
                <span className={styles.label}>Barriers</span>
                <BarrierChips items={current.barriers} context={x.code} onResolve={v => resolve(x.code, v)} />
              </>}
              {current.interventions.length > 0 && <>
                <span className={styles.label}>Interventions</span>
                <InterventionChips
                  items={current.interventions}
                  context={x.code}
                  onFinish={onFinish(x.code, null, [...current.barriers, ...drugBarriers.map(d => d.nonAdherenceReason)])}
                />
              </>}
            </div>
          )}
          {drugBarriers.length > 0 && !current?.medications && (
            <div className={`${styles.block} ${styles.drugs}`}>
              {drugBarriers.map(d => (
                <DrugBlock
                  key={d.id}
                  name={medLabel(d)}
                  barriers={[d.nonAdherenceReason]}
                  interventions={[]}
                  onResolve={v => resolve(x.code, v, { id: d.id, name: medLabel(d) })}
                />
              ))}
            </div>
          )}
        </DashboardCard>
      )))}

      {prompt}

      {view === 'history' && <ActivityLog entries={history} flushTop emptyLabel="No barriers or interventions logged yet." />}
    </div>
  );
}

// One drug's Barriers & Interventions (its detail panel), in the tab's
// layout: what stands for it now (its own record, or the gap's when logged
// for every drug, plus its Reason for Non-Adherence), with the same Resolve /
// Done / Didn't work actions, then its history, collapsed until opened.
const BARRIER_OPTIONS = BARRIERS.map(v => ({ value: v, label: v }));
const INTERVENTION_OPTIONS = INTERVENTIONS.map(v => ({ value: v, label: v }));

// Inline add under a drug's Barriers & Interventions: pick barriers and
// interventions, add a note, and log them for this drug only.
function DrugBarrierAdd({ member, x, d, onDone }) {
  const logInterventions = useAppStore(s => s.logPharmacyInterventions);
  const currentUser = useAppStore(s => s.currentUserProfile);
  const [add, setAdd] = useState({ barriers: [], interventions: [] });
  const [note, setNote] = useState('');
  const canSave = add.barriers.length > 0 || add.interventions.length > 0;
  const save = () => {
    const record = recordWithMedAdditions(x, latestFor(member.interventionLog, x.code)?.rec, d.id, add);
    logInterventions(member.id, {
      date: todayMdy(), by: currentUser?.name || 'You', note, medication: medLabel(d), measures: { [x.code]: record },
    });
    toast.success(`Added to ${medLabel(d)}`);
    onDone();
  };
  return (
    <div className={styles.addForm}>
      <Select label="Barriers" multiple badges searchable portal options={BARRIER_OPTIONS} value={add.barriers} placeholder="Add barriers" onValueChange={v => setAdd(a => ({ ...a, barriers: v }))} />
      <Select label="Interventions" multiple badges searchable portal options={INTERVENTION_OPTIONS} value={add.interventions} placeholder="Add interventions" onValueChange={v => setAdd(a => ({ ...a, interventions: v }))} />
      <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note" aria-label="Note" />
      <div className={styles.addActions}>
        <Button variant="outline" onClick={onDone}>Cancel</Button>
        <Button disabled={!canSave} onClick={save}>Add</Button>
      </div>
    </div>
  );
}

// `adding` / `onAddDone`: the host's + button opens the inline add form.
export function DrugBarriers({ member, code, medId, adding = false, onAddDone }) {
  const [showHistory, setShowHistory] = useState(false);
  const { resolve, onFinish, prompt } = useBarrierActions(member?.id);
  const x = member?.measures.find(m => m.code === code);
  const d = x?.medications.find(m => m.id === medId);
  // Its own lines (by id, or by name on older entries) and the gap-wide ones.
  const history = useMemo(() => {
    if (!x || !d) return [];
    const names = [d.name, medLabel(d)];
    return buildBarrierHistory(member, [x], line => (line.medId ? line.medId === d.id : (!line.medication || names.includes(line.medication))));
  }, [member, x, d]);
  if (!x || !d) return null;

  const latest = (member.interventionLog || []).find(e => hasBarrierData(e.measures?.[code]));
  const current = latest?.measures[code];
  const own = current?.medications?.find(r => r.id === d.id);
  const gapWide = !!current && !current.medications;
  const gapLevel = gapWide && !latest.medication && (current.barriers.length > 0 || current.interventions.length > 0);
  const fromRecord = own || (gapWide ? current : { barriers: [], interventions: [] });
  const reason = d.status !== 'Discontinued' && d.nonAdherenceReason;
  const barriers = [...fromRecord.barriers, ...(reason && !fromRecord.barriers.includes(reason) ? [reason] : [])];
  const interventions = fromRecord.interventions;
  const me = { id: d.id, name: medLabel(d) };
  // A gap-wide barrier resolves for the whole gap; the drug's own, for it.
  const scopeOf = (v) => (gapWide && current.barriers.includes(v) ? null : me);
  const ownList = (key) => (rec) => (rec.medications ? (rec.medications.find(r => r.id === d.id)?.[key] || []) : rec[key]);
  const barrierSince = sinceDates(member.interventionLog, code, barriers, ownList('barriers'));
  const interventionSince = sinceDates(member.interventionLog, code, interventions, ownList('interventions'));
  const count = history.filter(e => e.t !== 'group').length;

  return (
    <div className={styles.drugPanel}>
      {adding && <DrugBarrierAdd member={member} x={x} d={d} onDone={onAddDone} />}
      {gapLevel && <span className={styles.titleSub}>Applies to all {code} medications</span>}
      {barriers.length || interventions.length ? (
        <div className={styles.current}>
          {barriers.length > 0 && <>
            <span className={styles.label}>Barriers</span>
            <BarrierChips items={barriers} context={me.name} since={barrierSince} onResolve={v => resolve(code, v, scopeOf(v))} />
          </>}
          {interventions.length > 0 && <>
            <span className={styles.label}>Interventions</span>
            <InterventionChips items={interventions} context={me.name} since={interventionSince} onFinish={onFinish(code, own ? me : null, barriers)} />
          </>}
        </div>
      ) : <span className={styles.none}>No active barriers or interventions.</span>}
      {count > 0 && (
        <>
          <button type="button" className={styles.historyToggle} aria-expanded={showHistory} onClick={() => setShowHistory(v => !v)}>
            <DownChevronIcon size={12} color="currentColor" className={`${styles.chevron} ${showHistory ? '' : styles.chevronRight}`} />
            History ({count})
          </button>
          {showHistory && <ActivityLog entries={history} flushTop />}
        </>
      )}
      {prompt}
    </div>
  );
}
