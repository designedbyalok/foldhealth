import { useEffect, useState } from 'react';
import { Drawer } from '../../../components/Drawer/Drawer';
import { Button } from '../../../components/Button/Button';
import { RadioOptionGroup } from '../../../components/RadioOptionGroup/RadioOptionGroup';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
// Review step paused: the type's cancel / reschedule limit only governs
// patients, so staff aren't held to it. Restore if the PO wants it to apply
// to staff too (block, or block unless they have an override permission).
// import { insideWindow } from './typeWindows';
// import { WindowReview } from './WindowReview';
import styles from './AppointmentListView.module.css';

/**
 * Cancel Appointments, as a drawer (like Close Case, Figma Mar-Present
 * 2752:24038): the reason is required, picked from the practice's list.
 * Used for one appointment (a row's menu) and for a bulk selection.
 *
 * @param {object[]} props.appointments
 * @param {() => void} props.onDone   – after a successful cancel
 * @param {() => void} props.onClose
 */
export function CancelAppointmentsDrawer({ appointments: selected, onDone, onClose }) {
  const reasons = useAppStore(s => s.appointmentCancelReasons);
  const fetchReasons = useAppStore(s => s.fetchAppointmentCancelReasons);
  const cancelAppointments = useAppStore(s => s.cancelAppointments);
  const runCancelJob = useAppStore(s => s.runCancelJob);
  // const types = useAppStore(s => s.appointmentTypes);
  // const fetchTypes = useAppStore(s => s.fetchAppointmentTypes);
  useEffect(() => { fetchReasons(); }, [fetchReasons]);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  // const [dropped, setDropped] = useState(() => new Set());
  // const appointments = selected.filter(a => !dropped.has(a.id));
  // const inWindow = appointments.filter(a => insideWindow(types, a, 'cancel'));
  const appointments = selected;
  const n = appointments.length;

  const confirm = async () => {
    if (!reason || !n || saving) return;
    // Several at once run as a job, like Bulk Reschedule: the drawer closes
    // once it starts and the summary (what was cancelled, what wasn't) comes
    // as a notification.
    if (n > 1) {
      toast.success('Cancellation Job Started');
      onDone?.();
      onClose();
      await runCancelJob({ appointments, reason });
      return;
    }
    setSaving(true);
    const ok = await cancelAppointments(appointments, reason);
    setSaving(false);
    if (!ok) { toast.error('Appointments could not be cancelled. Try again.'); return; }
    toast.success('Appointment Cancelled Successfully');
    onDone?.();
    onClose();
  };

  return (
    <Drawer
      title={n === 1 ? 'Cancel Appointment' : 'Cancel Appointments'}
      onClose={onClose}
      noCloseDivider
      headerRight={(
        <>
          <Button variant="soft" tone="danger" disabled={!reason || !n || saving} onClick={confirm}>
            {n === 1 ? 'Cancel appointment' : 'Cancel appointments'}
          </Button>
          <span className={styles.headerDivider} aria-hidden="true" />
        </>
      )}
    >
      <div className={styles.cancelBody}>
        {/* <WindowReview items={inWindow} kind="cancel" types={types} onRemove={selected.length > 1 ? (a) => setDropped(d => new Set([...d, a.id])) : undefined} /> */}
        <span className={styles.cancelPrompt}>
          Please add a reason and confirm to cancel {n} selected {n === 1 ? 'appointment' : 'appointments'}:
        </span>
        <RadioOptionGroup
          className={styles.cancelReasons}
          name="cancel-reason"
          options={reasons.map(r => ({ value: r.label, label: r.label }))}
          value={reason}
          onChange={setReason}
        />
      </div>
    </Drawer>
  );
}
