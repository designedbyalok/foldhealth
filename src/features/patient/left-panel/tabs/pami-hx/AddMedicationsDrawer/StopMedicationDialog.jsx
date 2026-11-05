import { useState } from 'react';
import { ReasonDialog } from '../../../../../../components/ReasonDialog/ReasonDialog';
import { Input } from '../../../../../../components/Input/Input';
import { MEDICATION_STOP_REASONS } from './medicationStopReasons';
import { todayIso, toIsoDate } from '../../../../../../lib/clinicalDates';


/**
 * Stopping a medication needs a date and a reason, so the row's status
 * dropdown asks for both here rather than writing a half-recorded stop.
 *
 * The reason half is the shared ReasonDialog, without its notes field: one of
 * the canonical stop reasons is the whole record. This only adds the stop
 * date, which it also validates against the medication's start date.
 *
 * @param {object}   props
 * @param {object}   props.medication – The row being stopped; its start date
 *   bounds the stop date.
 * @param {function} props.onConfirm  – ({ stop, stopReason })
 * @param {function} props.onCancel
 */
export function StopMedicationDialog({ medication, onConfirm, onCancel }) {
  const [stop, setStop] = useState(todayIso());

  const start = toIsoDate(medication?.start);
  const stopTooEarly = !!(stop && start && stop < start);

  return (
    <ReasonDialog
      title="Mark Medication as Stopped"
      description="Select a stop date and reason for marking this medication as stopped."
      standardReasons={MEDICATION_STOP_REASONS}
      notes={false}
      confirmLabel="Save"
      confirmTone="primary"
      confirmDisabled={!stop || stopTooEarly}
      onCancel={onCancel}
      onSubmit={({ code }) => onConfirm({ stop, stopReason: code })}
    >
      <Input
        label="Stop Date"
        required
        type="date"
        value={stop}
        min={start || undefined}
        onChange={e => setStop(e.target.value)}
        errorText={stopTooEarly ? 'Stop date cannot be before the start date' : undefined}
      />
    </ReasonDialog>
  );
}
