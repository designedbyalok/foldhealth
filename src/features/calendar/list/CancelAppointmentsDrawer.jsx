import { useEffect, useState } from 'react';
import { Drawer } from '../../../components/Drawer/Drawer';
import { Button } from '../../../components/Button/Button';
import { RadioOptionGroup } from '../../../components/RadioOptionGroup/RadioOptionGroup';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
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
export function CancelAppointmentsDrawer({ appointments, onDone, onClose }) {
  const reasons = useAppStore(s => s.appointmentCancelReasons);
  const fetchReasons = useAppStore(s => s.fetchAppointmentCancelReasons);
  const cancelAppointments = useAppStore(s => s.cancelAppointments);
  useEffect(() => { fetchReasons(); }, [fetchReasons]);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const n = appointments.length;

  const confirm = async () => {
    if (!reason || saving) return;
    setSaving(true);
    const ok = await cancelAppointments(appointments, reason);
    setSaving(false);
    if (!ok) { toast.error('Appointments could not be cancelled. Try again.'); return; }
    toast.success(n === 1 ? 'Appointment Cancelled Successfully' : 'Appointments Cancelled Successfully');
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
          <Button variant="soft" tone="danger" disabled={!reason || saving} onClick={confirm}>
            {n === 1 ? 'Cancel appointment' : 'Cancel appointments'}
          </Button>
          <span className={styles.headerDivider} aria-hidden="true" />
        </>
      )}
    >
      <div className={styles.cancelBody}>
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
