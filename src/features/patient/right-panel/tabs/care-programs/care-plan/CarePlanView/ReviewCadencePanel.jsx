import { useState } from 'react';
import { useReviewCadence } from './useReviewCadence';
import { useAppStore } from '../../../../../../../store/useAppStore';
import { Badge } from '@/components/Badge/Badge';
import { Button } from '@/components/Button/Button';
import { Input } from '@/components/Input/Input';
import { NumberUnitInput } from '@/components/NumberUnitInput/NumberUnitInput';
import { CADENCE_UNITS, formatInterval } from '../lib/cadence';
import { fmtCarePlanDate } from '../tables/carePlanTableModel';
import styles from './ReviewCadencePanel.module.css';

const fmt = d => (d ? fmtCarePlanDate(d) : '');
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

function OverrideForm({ initial, current, baseLabel, onCancel, onSave, onReset }) {
  const [every, setEvery] = useState((initial || current).every);
  const [unit, setUnit] = useState((initial || current).unit);
  const [reason, setReason] = useState(initial?.reason ?? '');
  const valid = Number(every) >= 1;
  return (
    <>
      <NumberUnitInput
        label="Review every"
        value={every}
        onChange={setEvery}
        unit={unit}
        units={CADENCE_UNITS}
        onUnitChange={setUnit}
        errorText={valid ? undefined : 'At least 1'}
      />
      <Input label="Reason (optional)" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Recent fall, family request" />
      <span className={styles.hint}>Program default for this patient: {baseLabel}.</span>
      <div className={styles.actions}>
        {initial && <Button variant="ghost" size="sm" onClick={onReset}>Use Program Default</Button>}
        <span className={styles.spacer} />
        <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" disabled={!valid} onClick={() => onSave({ every: Number(every), unit, reason: reason.trim() || null })}>Save</Button>
      </div>
    </>
  );
}

function Detail({ label, children }) {
  return (
    <div className={styles.detail}>
      <span className={styles.detailLabel}>{label}</span>
      <span className={styles.detailValue}>{children}</span>
    </div>
  );
}

// What the panel says about a cadence: why it applies, the program's rules,
// and how due the next review is.
function describe({ cadence, override, status, config }) {
  const why = cadence.source === 'post_discharge'
    ? `Post-discharge until ${fmt(cadence.until)}`
    : cadence.source === 'override'
      ? (override?.reason ? `Override: ${override.reason}` : 'Patient override')
      : cadence.sourceLabel;
  const rules = [
    `Program default: ${formatInterval(config)}`,
    ...Object.entries(config.byAcuity || {}).map(([lvl, r]) => `${lvl} acuity: ${formatInterval(r)}`),
    config.postDischarge?.enabled ? `After a discharge: ${formatInterval(config.postDischarge)} for ${config.postDischarge.days} days` : null,
    `Overdue ${plural(Number(config.overdueAfterDays) || 0, 'day')} after the due date`,
  ].filter(Boolean);
  const tone = status.state === 'overdue' ? 'danger' : status.state === 'due' ? 'warning' : 'neutral';
  const stateLabel = status.state === 'overdue'
    ? `Overdue ${plural(status.daysOverdue, 'day')}`
    : status.state === 'due' ? (status.daysOverdue ? `Due ${plural(status.daysOverdue, 'day')} ago` : 'Due today') : null;
  return { why, rules, tone, stateLabel };
}

function useSaveCadence(patientId, info) {
  const setCadenceOverride = useAppStore(s => s.setCadenceOverride);
  return next => setCadenceOverride(patientId, info.enrollment, next, {
    fromLabel: info.cadence.label,
    toLabel: next ? formatInterval(next) : info.base.label,
  });
}

// The cadence, next and last review, the rules and the patient override.
function CadenceBody({ info, canEdit, editing, onEdit, onCancel, onSave }) {
  const { cadence, base, override, due, lastReview } = info;
  const { why, rules, tone, stateLabel } = describe(info);
  if (editing) {
    return (
      <OverrideForm
        initial={override}
        current={cadence}
        baseLabel={base.label}
        onCancel={onCancel}
        onSave={onSave}
        onReset={() => onSave(null)}
      />
    );
  }
  return (
    <>
      <div className={styles.details}>
        <Detail label="Cadence"><strong>{cadence.label}</strong> ({why})</Detail>
        <Detail label="Next review">
          {due ? <strong>{fmt(due)}</strong> : 'Scheduled once the plan is signed'}
          {stateLabel && <Badge size="sm" tone={tone} label={stateLabel} />}
        </Detail>
        <Detail label="Last reviewed">{lastReview ? fmt(new Date(lastReview)) : 'Not reviewed with the patient yet'}</Detail>
      </div>
      <ul className={styles.rules}>
        {rules.map(r => <li key={r}>{r}</li>)}
      </ul>
      {canEdit && (
        <div className={styles.actions}>
          <span className={styles.spacer} />
          <Button variant="outline" size="sm" leadingIcon="solar:pen-linear" onClick={onEdit}>
            {override ? 'Change Override' : 'Override for This Patient'}
          </Button>
        </div>
      )}
    </>
  );
}

/**
 * The review cadence laid out in place (the care plan overview's Review
 * Cadence tab): why it applies, the next and last review, the program's
 * rules and the patient override. `empty` shows when the program has none.
 */
export function ReviewCadencePanel({ patientId, program, plan, canEdit, empty = null }) {
  const info = useReviewCadence({ patientId, program, plan });
  const [editing, setEditing] = useState(false);
  const saveCadence = useSaveCadence(patientId, info || {});
  if (!info) return empty;
  return (
    <div className={styles.panel}>
      <CadenceBody
        info={info}
        canEdit={canEdit}
        editing={editing}
        onEdit={() => setEditing(true)}
        onCancel={() => setEditing(false)}
        onSave={async next => { setEditing(false); await saveCadence(next); }}
      />
    </div>
  );
}
