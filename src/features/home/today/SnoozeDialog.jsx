import { useState } from 'react';
import { ReasonDialog } from '../../../components/ReasonDialog/ReasonDialog';
import { Input } from '../../../components/Input/Input';
import { addDaysIso, SNOOZE_MAX_DAYS, SNOOZE_REASONS } from './snooze';
import { todayIso } from '../../../lib/clinicalDates';

/**
 * Snoozing a next action needs a reason and an end date (review F-24), so the
 * row comes back on its own and the next person can see why it was put off.
 *
 * @param {object}   props
 * @param {object}   props.item      – The Today row being snoozed
 * @param {function} props.onConfirm – ({ reason, note, until })
 * @param {function} props.onCancel
 */
export function SnoozeDialog({ item, onConfirm, onCancel }) {
  const today = todayIso();
  const min = addDaysIso(today, 1);
  const max = addDaysIso(today, SNOOZE_MAX_DAYS);
  const [until, setUntil] = useState(min);
  const outOfRange = !!until && (until < min || until > max);

  return (
    <ReasonDialog
      title="Snooze Next Action"
      description={`${item.patientName} moves to the bottom of your list until the date you pick, then comes back on its own.`}
      standardReasons={SNOOZE_REASONS}
      notesPlaceholder="Add context for whoever picks this up…"
      confirmLabel="Snooze"
      confirmTone="primary"
      confirmDisabled={!until || outOfRange}
      onCancel={onCancel}
      onSubmit={({ code, freeText }) => onConfirm({
        reason: code || freeText,
        note: code ? freeText || null : null,
        until,
      })}
    >
      <Input
        label="Snooze Until"
        required
        type="date"
        value={until}
        min={min}
        max={max}
        onChange={(e) => setUntil(e.target.value)}
        errorText={outOfRange ? `Pick a date from tomorrow up to ${SNOOZE_MAX_DAYS} days out` : undefined}
      />
    </ReasonDialog>
  );
}
