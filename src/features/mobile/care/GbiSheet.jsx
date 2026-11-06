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
import styles from './care.module.css';

const NOUN = { goal: 'Goal', intv: 'Intervention', barrier: 'Barrier' };
const SAVE = { goal: 'savePatientCarePlanGoal', intv: 'savePatientCarePlanIntervention', barrier: 'savePatientCarePlanBarrier' };

/**
 * A goal, intervention or barrier: its details, Change Status (with the
 * reason the org asks for), and for goals, Record Reading.
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
  const [mode, setMode] = useState('view'); // 'view' | 'status' | 'reading'
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
            {kind === 'goal' && goalReadingSpec(item).kind !== 'assessment' && (
              <Button variant="outline" onClick={() => setMode('reading')}>Record Reading</Button>
            )}
            <Button variant="solid" onClick={() => setMode('status')}>Change Status</Button>
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
            <Button variant="ghost" onClick={() => setMode('view')} disabled={busy}>Back</Button>
            <Button variant="solid" onClick={saveStatus} disabled={!canSaveStatus || busy}>Change Status</Button>
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
        <Button variant="ghost" onClick={onCancel} disabled={busy}>Back</Button>
        <Button variant="solid" disabled={!canSave || busy} onClick={() => onSave({ value, unit: spec.unit || '', favorable })}>Save Reading</Button>
      </div>
    </>
  );
}
