import { useState } from 'react';
import { Badge } from '../../../components/Badge/Badge';
import { Button } from '../../../components/Button/Button';
import { DatePickerPopover } from '../../../components/DatePicker/DatePickerPopover';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import { toIso } from './useCisTracker';
import { fmtDate, isLocked } from './cisStatusConfig';
import styles from './DoseDateField.module.css';

/**
 * Date administered for one CIS dose: a white Badge that opens the date
 * picker (with "Clear date" once a date is set), or a locked grey Badge
 * until the dose's window opens.
 *
 * @param {object}   props
 * @param {object}   props.row      – dose row from evaluateCis()
 * @param {string}   props.label    – vaccine label, for screen readers
 * @param {Date}     props.dob
 * @param {function} props.onChange – (iso) => void; '' clears the date
 */
export function DoseDateField({ row, label, dob, onChange }) {
  const [pickerRect, setPickerRect] = useState(null);
  if (isLocked(row)) {
    return (
      <Tooltip label={`Opens on ${fmtDate(row.earliest)}`} variant="light">
        <span
          className={styles.locked}
          aria-disabled="true"
          aria-label={`${label} dose ${row.number} given date: opens ${fmtDate(row.earliest)}`}
        >
          <Badge disabled size="md" icon="solar:lock-keyhole-minimalistic-linear" label="Select Date" />
        </span>
      </Tooltip>
    );
  }
  const pick = (iso) => { setPickerRect(null); onChange(iso); };
  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        onClick={(e) => setPickerRect(e.currentTarget.getBoundingClientRect())}
        aria-haspopup="dialog"
        aria-label={`${label} dose ${row.number} given date: ${row.record ? fmtDate(row.record.date) : 'not given'}`}
      >
        <Badge
          variant="outline"
          size="md"
          label={row.record ? fmtDate(row.record.date) : 'Select Date'}
          className={row.record ? undefined : styles.placeholder}
        />
      </button>
      {pickerRect && (
        <DatePickerPopover
          open
          value={row.record ? toIso(row.record.date) : ''}
          anchorRect={pickerRect}
          min={toIso(dob)}
          max={toIso(new Date())}
          onChange={pick}
          onClose={() => setPickerRect(null)}
          footer={row.record ? (
            <div className={styles.pickerFooter}>
              <Button variant="outline" size="sm" onClick={() => pick('')}>Clear date</Button>
            </div>
          ) : null}
        />
      )}
    </>
  );
}
