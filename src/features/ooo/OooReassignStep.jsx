import { DateTimePicker } from '../../components/DateTimePicker/DateTimePicker';
import { Banner } from '../../components/Banner/Banner';
import { RadioButton } from '../../components/RadioButton/RadioButton';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { fromPickerValue, toPickerValue } from './oooUtils';
import styles from './ooo.module.css';

/**
 * The Reassign Appointments drawer's footer: what the plan will do, live.
 *
 * @param {{ reassigning: number, cancelling: number, noAction: number }} props
 */
export function OooReassignFooter({ reassigning = 0, cancelling = 0, noAction = 0 }) {
  return (
    <div className={styles.reassignFooter}>
      <span>Reassigning: <span className={reassigning ? styles.footerReassign : undefined}>{reassigning}</span></span>
      <span aria-hidden="true">•</span>
      <span>Cancelling: <span className={cancelling ? styles.footerCancel : undefined}>{cancelling}</span></span>
      <span aria-hidden="true">•</span>
      <span>No action: {noAction}</span>
    </div>
  );
}

/**
 * "Select Covering Providers" before there's anything to plan (Figma
 * Eventus 16898:43570): until a provider and their dates are chosen. Once
 * the provider is picked, it only asks for the dates.
 *
 * @param {object}  props
 * @param {boolean} [props.hasProvider]
 */
export function ReassignProviders({ hasProvider = false }) {
  return (
    <div className={styles.fieldGroup}>
      <span className={styles.groupTitle}>Select Covering Providers</span>
      <div className={styles.providersEmpty}>
        <EmptyState size="sm" icon="solar:users-group-rounded-linear" title={hasProvider ? 'Select dates to Reassign Appointments' : 'Select Provider and dates to Reassign Appointments'} />
      </div>
    </div>
  );
}

const TYPES = [
  { key: 'ooo', label: 'Out of Office' },
  { key: 'permanent', label: 'Permanent' },
  { key: 'other', label: 'One-time' },
];

/**
 * "Select Reassignment Type" (Figma Eventus 17599:119759): three radios,
 * and under them what that type needs. Out of office: the record
 * (`oooField`). Permanent: a note that everything moves. One-time: a start
 * and end date and time, the same fields as the Out of Office drawer.
 *
 * @param {object}   props
 * @param {'ooo'|'permanent'|'other'} props.type
 * @param {function} props.onTypeChange
 * @param {{ startAt: string|null, endAt: string|null }} props.range – One-time (ISO)
 * @param {function} props.onRangeChange – (range) => void
 * @param {React.ReactNode} props.oooField
 */
export function ReassignmentType({ type, onTypeChange, range = { startAt: null, endAt: null }, onRangeChange, oooField }) {
  const today = new Date();
  const endBeforeStart = range.startAt && range.endAt && new Date(range.endAt) <= new Date(range.startAt);
  return (
    <div className={`${styles.fieldGroup} ${styles.reassignGroup}`}>
      <span className={styles.groupTitle}>Select Reassignment Type</span>
      <div className={styles.radioRow} role="radiogroup" aria-label="Reassignment type">
        {TYPES.map(t => (
          <RadioButton key={t.key} label={t.label} checked={type === t.key} onChange={() => onTypeChange(t.key)} />
        ))}
      </div>
      {type === 'ooo' && oooField}
      {type === 'permanent' && (
        <Banner icon="solar:info-circle-linear" tone="warning" size="sm">All appointments will be reassigned, this is typically done when provider leaves the organization.</Banner>
      )}
      {type === 'other' && (
        <div className={styles.dateRow}>
          <DateTimePicker
            label="Start Date & Time"
            required
            fullWidth
            hour12
            autoCommit
            placeholder="Select Start Date & Time"
            minDate={today}
            value={toPickerValue(range.startAt)}
            onChange={(v) => onRangeChange({ ...range, startAt: fromPickerValue(v) })}
          />
          <DateTimePicker
            label="End Date & Time"
            required
            fullWidth
            hour12
            autoCommit
            placeholder="Select End Date & Time"
            minDate={range.startAt ? new Date(range.startAt) : today}
            value={toPickerValue(range.endAt)}
            onChange={(v) => onRangeChange({ ...range, endAt: fromPickerValue(v) })}
            errorText={endBeforeStart ? 'End must be after the start.' : undefined}
          />
        </div>
      )}
    </div>
  );
}
