import { useEffect, useState } from 'react';
import { Avatar } from '../../../components/Avatar/Avatar';
import { Badge } from '../../../components/Badge/Badge';
import { BottomSheet } from '../../../components/BottomSheet/BottomSheet';
import { Button } from '../../../components/Button/Button';
import { Icon } from '../../../components/Icon/Icon';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import { durationMin, lockedReason, statusBlockedReason, statusLabel, statusValue, modeLabel } from '../../calendar/list/appointmentList';
import { MobileSubHeader } from '../MobileHeader';
import { MobileEmpty, MobileListSkeleton } from '../MobileParts';
import { useMobileNav } from '../MobileNavContext';
import { initialsOf } from '../mobileFormat';
import { appointmentStart } from './appointmentTime';
import common from '../mobile.module.css';
import styles from './AppointmentScreen.module.css';

const STATUS_TONE = { Booked: 'success', 'Checked In': 'success', 'Checked Out': 'success', Pending: 'warning', Proposed: 'info', Cancelled: 'danger', Declined: 'danger', 'No Show': 'neutral' };

/**
 * One appointment (Figma drawer 1082:53422): who, when, where, why, plus
 * Check In and Cancel with the same rules and status values as the
 * desktop appointment list.
 */
export function AppointmentScreen({ appointmentId }) {
  const { pop, openMember } = useMobileNav();
  const appt = useAppStore(s => (s.appointments || []).find(a => String(a.id) === String(appointmentId)) || null);
  const loading = useAppStore(s => s.appointmentsLoading);
  const fetchAppointments = useAppStore(s => s.fetchAppointments);
  const updateAppointment = useAppStore(s => s.updateAppointment);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetchAppointments?.(); }, [fetchAppointments]);

  if (!appt) {
    return (
      <div className={common.screen}>
        <MobileSubHeader title="Appointment" />
        <div className={common.body}>
          {loading ? <MobileListSkeleton count={3} /> : <MobileEmpty icon="solar:calendar-minimalistic-linear" title="Appointment not found" />}
        </div>
      </div>
    );
  }

  const status = statusLabel(appt);
  const locked = lockedReason(appt);
  const cancelled = status === 'Cancelled';
  const checkInBlocked = statusBlockedReason(appt, 'Checked In');
  const start = appointmentStart(appt);
  const dateText = start ? start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : appt.date;
  const secondary = (appt.secondary_users || []).map(u => (typeof u === 'string' ? u : u?.name)).filter(Boolean);
  const virtual = /virtual|tele/i.test(appt.mode || '');

  const setStatus = async (next, done) => {
    setBusy(true);
    let ok;
    try { ok = await updateAppointment(appt.id, { status: statusValue(next) }); } finally { setBusy(false); }
    if (ok) {
      toast.success(done);
      return true;
    }
    toast.error('Could not update the appointment.');
    return false;
  };

  return (
    <div className={common.screen}>
      <MobileSubHeader title={appt.appointment_type_name || 'Appointment'} />
      <div className={common.body}>
        <div className={styles.wrap}>
          <button
            type="button"
            className={common.card}
            onClick={() => openMember({ id: appt.patient_id, name: appt.patient_name })}
            disabled={!appt.patient_id && !appt.patient_name}
          >
            <Avatar variant="patient" size="XL" initials={initialsOf(appt.patient_name)} />
            <span className={common.cardText}>
              <span className={common.primaryText}>{appt.patient_name || 'No member'}</span>
              <span className={common.secondaryText}>View profile</span>
            </span>
            <Icon name="solar:alt-arrow-right-linear" size={20} />
          </button>

          <div className={styles.details}>
            <Row icon="solar:user-linear">
              <span className={styles.rowMain}>{appt.primary_user || 'Unassigned'}</span>
              <Badge size="sm" variant="soft" tone={STATUS_TONE[status] || 'neutral'} label={status} />
            </Row>
            <Row icon="solar:calendar-minimalistic-linear">{dateText}</Row>
            <Row icon="solar:clock-circle-linear">
              {[appt.time_start, appt.time_end].filter(Boolean).join(' - ')} ({durationMin(appt)} min)
            </Row>
            <Row icon={virtual ? 'solar:videocamera-record-linear' : 'solar:map-point-linear'}>
              {[modeLabel(appt) !== '-' ? modeLabel(appt) : '', appt.location].filter(Boolean).join(' • ') || 'No location'}
            </Row>
            {secondary.length > 0 && <Row icon="solar:users-group-rounded-linear">{secondary.join(', ')}</Row>}
          </div>

          {appt.reason_for_visit && (
            <div className={styles.block}>
              <span className={styles.blockLabel}>Visit Reason</span>
              <p className={styles.blockText}>{appt.reason_for_visit}</p>
            </div>
          )}

          {!cancelled && (
            <div className={styles.actions}>
              {status !== 'Checked In' && status !== 'Checked Out' && (
                <Button size="lg"
                  variant="outline"
                  fullWidth
                  disabled={busy || !!checkInBlocked}
                  disabledReason={checkInBlocked || undefined}
                  onClick={() => setStatus('Checked In', 'Member checked in')}
                >
                  Check In Member
                </Button>
              )}
              {checkInBlocked && status !== 'Checked In' && <p className={styles.hint}>{checkInBlocked}</p>}
              {!locked && (
                <Button size="lg" variant="soft" tone="danger" fullWidth disabled={busy} onClick={() => setConfirmCancel(true)}>
                  Cancel Appointment
                </Button>
              )}
              {locked && <p className={styles.hint}>{locked}</p>}
            </div>
          )}
        </div>
      </div>

      {confirmCancel && (
        <BottomSheet title="Cancel Appointment?" onClose={() => setConfirmCancel(false)}>
          <p className={styles.confirmText}>
            {appt.patient_name ? `${appt.patient_name}'s ` : ''}{appt.appointment_type_name || 'appointment'} on {dateText} at {appt.time_start} will be cancelled.
          </p>
          <Button size="lg"
            variant="soft"
            tone="danger"
            fullWidth
            disabled={busy}
            onClick={async () => {
              const ok = await setStatus('Cancelled', 'Appointment cancelled');
              if (ok) { setConfirmCancel(false); pop(); }
            }}
          >
            Confirm
          </Button>
        </BottomSheet>
      )}
    </div>
  );
}

function Row({ icon, children }) {
  return (
    <div className={styles.row}>
      <Icon name={icon} size={24} />
      <span className={styles.rowText}>{children}</span>
    </div>
  );
}
