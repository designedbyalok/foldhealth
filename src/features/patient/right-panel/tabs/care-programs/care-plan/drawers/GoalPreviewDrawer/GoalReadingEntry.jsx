import { useState } from 'react';
import { Input } from '../../../../../../../../components/Input/Input';
import { Select } from '../../../../../../../../components/Select/Select';
import { Button } from '../../../../../../../../components/Button/Button';
import { DatePickerPopover } from '../../../../../../../../components/DatePicker/DatePickerPopover';
import { formatGoalTarget } from '../../../../../../../settings/care-plan-library/lib';
import { goalReadingSpec, evaluateReading, ASSESSMENT_COMPLETED } from '../../lib/goalReadings';
import { fmtCarePlanDate, parseCarePlanDate } from '../../tables/carePlanTableModel';
import styles from './GoalPreviewDrawer.module.css';

const todayYmd = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Picked dates are date-only; store them at local noon so the reading lands
// on the chosen day in every timezone.
const ymdToIso = (ymd) => {
  const d = parseCarePlanDate(ymd);
  if (!d) return new Date().toISOString();
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
};

/**
 * Add-a-reading row for a measurable goal. The control follows the goal's
 * measure (two parts for Blood Pressure, a 0–10 scale for Pain, a number with
 * its unit, or free text with the goal's own unit). In / out of target is
 * computed from the goal's target and can be overridden; when the target
 * can't be judged the clinician must pick one before saving.
 */
export function GoalReadingEntry({ goal, onSave }) {
  const spec = goalReadingSpec(goal);
  const [single, setSingle] = useState('');
  const [parts, setParts] = useState(['', '']);
  const [override, setOverride] = useState(null); // null | true | false

  const value = spec.kind === 'dual'
    ? (parts[0].trim() && parts[1].trim() ? `${parts[0].trim()}${spec.separator}${parts[1].trim()}` : '')
    : single.trim();
  const computed = value ? evaluateReading(goal, value) : null;
  const favorable = override ?? computed;
  const target = formatGoalTarget(goal);
  const canSave = !!value && favorable != null;

  const reset = () => { setSingle(''); setParts(['', '']); setOverride(null); };
  const save = async () => {
    if (!canSave) return;
    await onSave({ value, unit: spec.unit || '', favorable });
    reset();
  };
  const onEnter = (e) => { if (e.key === 'Enter') save(); };

  let field;
  if (spec.kind === 'dual') {
    field = (
      <span className={styles.readingDual}>
        {[0, 1].map(i => (
          <Input
            key={i}
            inputMode="decimal"
            placeholder={spec.labels[i]}
            value={parts[i]}
            onChange={e => setParts(p => (i === 0 ? [e.target.value, p[1]] : [p[0], e.target.value]))}
            onKeyDown={onEnter}
            trailingText={spec.units[i] || undefined}
            aria-label={spec.labels[i]}
          />
        ))}
      </span>
    );
  } else if (spec.kind === 'select') {
    field = (
      <Select
        options={spec.options.map(o => ({ value: o, label: o }))}
        value={single}
        onChange={setSingle}
        placeholder="Select value"
        portal
      />
    );
  } else {
    field = (
      <Input
        inputMode={spec.kind === 'number' ? 'decimal' : undefined}
        placeholder="Value"
        value={single}
        onChange={e => setSingle(e.target.value)}
        onKeyDown={onEnter}
        trailingText={spec.unit || undefined}
        aria-label="Reading value"
      />
    );
  }

  // Caption explains where the in/out call came from.
  let caption = null;
  if (value && computed != null && override == null) caption = `Auto, from target ${target}`;
  else if (value && override != null && computed != null && override !== computed) caption = `Overridden; target says ${computed ? 'in' : 'out of'} target`;
  else if (value && computed == null) caption = target ? `Can't check "${target}" automatically. Choose one.` : 'No target set. Choose one.';

  return (
    <div className={styles.readingEntry}>
      <div className={styles.addRow}>
        {field}
        <span className={styles.favorableGroup} role="group" aria-label="Target result">
          {[true, false].map(v => (
            <button
              key={String(v)}
              type="button"
              aria-pressed={favorable === v}
              className={`${styles.favorableToggle} ${favorable === v ? (v ? styles.favorableOn : styles.favorableOff) : styles.favorableIdle}`}
              onClick={() => setOverride(v)}
            >
              {v ? 'In target' : 'Out of target'}
            </button>
          ))}
        </span>
        <Button variant="primary" size="S" onClick={save} disabled={!canSave}>Save</Button>
      </div>
      {caption && <span className={styles.readingCaption}>{caption}</span>}
    </div>
  );
}

/**
 * Assessment goals have no value to read: they're done on a date. Marking
 * one complete records a dated "Completed" reading (history + audit) and sets
 * the goal to Met.
 */
export function GoalCompletion({ goal, readings, canEdit, onComplete }) {
  const [pickerRect, setPickerRect] = useState(null);
  const done = [...readings].reverse().find(r => r.value === ASSESSMENT_COMPLETED);
  const due = parseCarePlanDate(goal.targetDate);
  const doneAt = done ? new Date(done.takenAt) : null;
  const late = doneAt && due && doneAt > new Date(due.getFullYear(), due.getMonth(), due.getDate(), 23, 59, 59);

  if (done) {
    return (
      <div className={styles.emptyCard}>
        <span className={styles.completionDone}>
          Completed on {fmtCarePlanDate(done.takenAt)}
          {late && <span className={styles.completionLate}> (after the {fmtCarePlanDate(goal.targetDate)} target date)</span>}
        </span>
      </div>
    );
  }
  return (
    <div className={styles.emptyCard}>
      <span>
        {due ? `Due by ${fmtCarePlanDate(goal.targetDate)}. ` : 'No target date set. '}
        Not completed yet.
      </span>
      {canEdit && (
        <span className={styles.completionAction}>
          <Button
            variant="secondary"
            size="S"
            leadingIcon="solar:check-circle-linear"
            onClick={(e) => setPickerRect(e.currentTarget.getBoundingClientRect())}
          >
            Mark completed
          </Button>
        </span>
      )}
      {pickerRect && (
        <DatePickerPopover
          open
          value={todayYmd()}
          max={todayYmd()}
          anchorRect={pickerRect}
          onChange={(ymd) => { setPickerRect(null); if (ymd) onComplete(ymdToIso(ymd)); }}
          onClose={() => setPickerRect(null)}
        />
      )}
    </div>
  );
}
