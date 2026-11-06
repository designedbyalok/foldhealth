import { useState } from 'react';
import { Badge } from '../../../components/Badge/Badge';
import { BottomSheet } from '../../../components/BottomSheet/BottomSheet';
import { Button } from '../../../components/Button/Button';
import { Input } from '../../../components/Input/Input';
import { Textarea } from '../../../components/Textarea/Textarea';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import { gbiStatusesFor } from '../../patient/right-panel/tabs/care-programs/care-plan/lib/gbiStatus';
import { statusReasonRequired, statusReasonsFor } from '../../patient/right-panel/tabs/care-programs/care-plan/lib/gbiStatusReasons';
import { statusReasonPatch } from '../../patient/right-panel/tabs/care-programs/care-plan/lib/confirmStatusChange';
import { evaluateReading, goalReadingSpec } from '../../patient/right-panel/tabs/care-programs/care-plan/lib/goalReadings';
import { RadioOptionGroup } from '../../../components/RadioOptionGroup/RadioOptionGroup';
import { gbiTone } from './careUtils';
import { ConfirmSheet } from './CarePlanSheets';
import styles from './care.module.css';

const NOUN = { goal: 'Goal', intv: 'Intervention', barrier: 'Barrier' };
const SAVE = { goal: 'savePatientCarePlanGoal', intv: 'savePatientCarePlanIntervention', barrier: 'savePatientCarePlanBarrier' };
const DELETE = { goal: 'deletePatientCarePlanGoal', intv: 'deletePatientCarePlanIntervention', barrier: 'deletePatientCarePlanBarrier' };

/**
 * A goal, intervention or barrier: its details, Change Status (with the
 * reason the org asks for), for goals Record Reading, and Delete (a goal
 * takes its linked interventions and barriers with it, as desktop does).
 *
 * Status saves go the same way as desktop saveGbiStatus: the reason is
 * recorded first (presetGbiStatusReason, so the gbi_status_history row
 * carries it) and the item is saved with its new status and statusReason.
 * The desktop reason dialog host isn't mounted on mobile, so this sheet
 * asks for the reason itself instead of confirmStatusChange.
 */
export function GbiSheet({ kind, item, details = [], patientId, program, onClose }) {
  const askReason = useAppStore(s => s.askStatusChangeReason);
  const presetGbiStatusReason = useAppStore(s => s.presetGbiStatusReason);
  const save = useAppStore(s => s[SAVE[kind]]);
  const saveGoalMeasurement = useAppStore(s => s.saveGoalMeasurement);
  const remove = useAppStore(s => s[DELETE[kind]]);
  const plan = useAppStore(s => s.patientCarePlans[`${patientId}::${program.id}`]);
  const [mode, setMode] = useState('view'); // 'view' | 'status' | 'reading' | 'delete'
  const [to, setTo] = useState(null);
  const [reason, setReason] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const statuses = gbiStatusesFor(kind === 'intv' ? 'intervention' : kind);
  const reasons = to ? statusReasonsFor(to) : [];
  const required = !!to && askReason && statusReasonRequired(to);
  const canSaveStatus = !!to && to !== item.status && (!required || !!reason || !!note.trim());

  const saveStatus = async () => {
    if (!canSaveStatus) return;
    setBusy(true);
    const why = askReason ? { reason: reason || (note.trim() ? 'Other' : null), note: note.trim() || null } : { reason: null, note: null };
    if (askReason) presetGbiStatusReason([item.id], why);
    let saved = null;
    try {
      saved = await save(patientId, program, { ...item, status: to, ...statusReasonPatch(item, why) }, item.id);
    } catch {
      toast.error('Could not change the status.');
    }
    setBusy(false);
    // A refused save shows the store's own error toast.
    if (saved) { toast.success(`${NOUN[kind]} set to ${to}`); onClose(); }
  };

  // Desktop confirmDelete / removeGoal(true).
  const name = item.title || item.description || 'Untitled';
  const linked = kind === 'goal'
    ? (plan?.interventions || []).filter(i => i.goalId === item.id).length
      + (plan?.barriers || []).filter(b => (b.goalIds || []).includes(item.id)).length
    : 0;
  const confirmDelete = async () => {
    setBusy(true);
    try {
      if (kind === 'goal') await remove(patientId, program.id, item.id, { cascade: true });
      else await remove(patientId, program.id, item.id);
      toast.success(kind === 'goal'
        ? (linked ? 'Goal & linked items removed successfully' : 'Goal removed successfully')
        : `"${name}" removed`);
      onClose();
    } catch {
      toast.error(`Could not delete the ${NOUN[kind].toLowerCase()}.`);
      setBusy(false);
    }
  };

  if (mode === 'delete') {
    return (
      <ConfirmSheet
        title={`Delete ${NOUN[kind]}?`}
        text={kind === 'goal' && linked
          ? `"${name}" and its ${linked} linked item${linked === 1 ? '' : 's'} (interventions and barriers) will be removed from this care plan.`
          : `"${name}" will be removed from this care plan.`}
        confirmLabel="Delete"
        busy={busy}
        onConfirm={confirmDelete}
        onClose={() => setMode('view')}
      />
    );
  }

  return (
    <BottomSheet title={NOUN[kind]} onClose={onClose}>
      <p className={styles.sheetText}>{item.title || item.description || 'Untitled'}</p>
      {mode === 'view' && (
        <>
          <div className={styles.heroRow}>
            <Badge size="sm" tone={gbiTone(item.status)} variant="soft" label={item.status} />
            {item.priority && <Badge size="sm" tone="neutral" variant="soft" label={`${item.priority[0].toUpperCase()}${item.priority.slice(1)} priority`} />}
          </div>
          {details.filter(Boolean).map(d => <p key={d} className={styles.sheetMeta}>{d}</p>)}
          {item.statusReason && <p className={styles.sheetMeta}>Last change: {item.statusReason}</p>}
          <div className={styles.actions}>
            <Button size="lg" variant="ghost" tone="danger" leadingIcon="solar:trash-bin-minimalistic-linear" onClick={() => setMode('delete')}>Delete</Button>
            {kind === 'goal' && goalReadingSpec(item).kind !== 'assessment' && (
              <Button size="lg" variant="outline" onClick={() => setMode('reading')}>Record Reading</Button>
            )}
            <Button size="lg" variant="solid" onClick={() => setMode('status')}>Change Status</Button>
          </div>
        </>
      )}

      {mode === 'status' && (
        <>
          <RadioOptionGroup
            label="New status"
            variant="card"
            options={statuses.map(s => ({ value: s, label: s, hint: item.status === s ? 'Current' : undefined }))}
            value={to}
            onChange={(s) => { setTo(s); setReason(null); }}
          />
          {askReason && to && to !== item.status && (
            <>
              <RadioOptionGroup
                label={`Reason${required ? ' (required)' : ' (optional)'}`}
                variant="card"
                options={reasons.map(r => ({ value: r, label: r }))}
                value={reason}
                onChange={setReason}
              />
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add context an auditor or the next care manager should see" aria-label="Status note" />
            </>
          )}
          <div className={styles.actions}>
            <Button size="lg" variant="ghost" onClick={() => setMode('view')} disabled={busy}>Back</Button>
            <Button size="lg" variant="solid" onClick={saveStatus} disabled={!canSaveStatus || busy}>Change Status</Button>
          </div>
        </>
      )}

      {mode === 'reading' && (
        <ReadingForm
          goal={item}
          busy={busy}
          onCancel={() => setMode('view')}
          onSave={async (reading) => {
            setBusy(true);
            const saved = await saveGoalMeasurement(patientId, program.id, item.id, reading).catch(() => null);
            setBusy(false);
            if (saved) { toast.success('Reading recorded'); onClose(); }
            // saveGoalMeasurement shows its own error toast.
          }}
        />
      )}
    </BottomSheet>
  );
}

/** A goal reading, entered the way the goal's measure needs (desktop GoalReadingEntry). */
function ReadingForm({ goal, busy, onSave, onCancel }) {
  const spec = goalReadingSpec(goal);
  const [single, setSingle] = useState('');
  const [parts, setParts] = useState(['', '']);
  const [override, setOverride] = useState(null);
  const value = spec.kind === 'dual'
    ? (parts[0].trim() && parts[1].trim() ? `${parts[0].trim()}${spec.separator}${parts[1].trim()}` : '')
    : single.trim();
  const computed = value ? evaluateReading(goal, value) : null;
  const favorable = override ?? computed;
  const canSave = !!value && favorable != null;

  return (
    <>
      {spec.kind === 'dual' ? (
        <div className={styles.dates}>
          {[0, 1].map(i => (
            <Input
              key={i}
              size="lg"
              inputMode="decimal"
              label={spec.labels?.[i] || `Value ${i + 1}`}
              trailingText={spec.units?.[i] || undefined}
              value={parts[i]}
              onValueChange={(v) => setParts(p => (i === 0 ? [v, p[1]] : [p[0], v]))}
            />
          ))}
        </div>
      ) : spec.kind === 'select' ? (
        <RadioOptionGroup
          label="Reading"
          variant="card"
          options={(spec.options || []).map(o => (typeof o === 'object'
            ? { value: String(o.value), label: o.label }
            : { value: String(o), label: String(o) }))}
          value={single}
          onChange={setSingle}
        />
      ) : (
        <Input
          size="lg"
          inputMode={spec.kind === 'number' ? 'decimal' : undefined}
          label="Reading"
          trailingText={spec.unit || undefined}
          value={single}
          onValueChange={setSingle}
        />
      )}
      {value && computed == null && (
        <>
          <RadioOptionGroup
            label="Target result"
            variant="card"
            options={[{ value: 'in', label: 'In target' }, { value: 'out', label: 'Out of target' }]}
            value={override == null ? null : override ? 'in' : 'out'}
            onChange={(v) => setOverride(v === 'in')}
          />
        </>
      )}
      {value && computed != null && <p className={styles.sheetMeta}>{computed ? 'In target' : 'Out of target'}</p>}
      <div className={styles.actions}>
        <Button size="lg" variant="ghost" onClick={onCancel} disabled={busy}>Back</Button>
        <Button size="lg" variant="solid" disabled={!canSave || busy} onClick={() => onSave({ value, unit: spec.unit || '', favorable })}>Save Reading</Button>
      </div>
    </>
  );
}
