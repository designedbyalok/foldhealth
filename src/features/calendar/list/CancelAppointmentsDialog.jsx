import { useEffect, useState } from 'react';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { RadioOptionGroup } from '../../../components/RadioOptionGroup/RadioOptionGroup';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import styles from './AppointmentListView.module.css';

/**
 * Cancel Appointments? (Figma 3023:575134): the reason is required, picked
 * from the practice's list. Used for one appointment (a row's menu) and for
 * a bulk selection.
 *
 * @param {object[]} props.appointments
 * @param {() => void} props.onDone   – after a successful cancel
 * @param {() => void} props.onClose
 */
export function CancelAppointmentsDialog({ appointments, onDone, onClose }) {
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
    // Figma 3013:562753.
    <ConfirmDialog
      variant="warning"
      icon="solar:danger-triangle-linear"
      title={n === 1 ? 'Cancel Appointment?' : 'Cancel Appointments?'}
      description={(
        <span className={styles.cancelDesc}>
          Please add a reason and confirm to cancel {n} selected {n === 1 ? 'appointment' : 'appointments'}:
        </span>
      )}
      cancelLabel="Dismiss"
      confirmLabel={n === 1 ? 'Cancel appointment' : 'Cancel appointments'}
      confirmDisabled={!reason}
      loading={saving}
      className={styles.cancelDialog}
      onCancel={onClose}
      onConfirm={confirm}
    >
      <RadioOptionGroup
        className={styles.cancelReasons}
        name="cancel-reason"
        options={reasons.map(r => ({ value: r.label, label: r.label }))}
        value={reason}
        onChange={setReason}
      />
    </ConfirmDialog>
  );
}
