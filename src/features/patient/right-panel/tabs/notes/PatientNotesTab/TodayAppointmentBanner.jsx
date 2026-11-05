import { Button } from '../../../../../../components/Button/Button';
import { formatDate } from './noteRows';
import styles from './TodayAppointmentBanner.module.css';

function metaLine(appt, title) {
  const others = Array.isArray(appt.secondary_users) ? appt.secondary_users.length : 0;
  const provider = appt.primary_user ? `${appt.primary_user}${others ? ` + ${others}` : ''}` : null;
  const time = appt.at.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const type = appt.appointment_type_name !== title ? appt.appointment_type_name : null;
  return [type, provider, `${formatDate(appt.at)} ${time}`].filter(Boolean).join(' • ');
}

export function TodayAppointmentBanner({ appointment, onAddVisitNote }) {
  const title = appointment.reason_for_visit || appointment.appointment_type_name || 'Appointment';
  return (
    <section className={styles.banner} aria-label="Today's appointment">
      <div className={styles.heading}>Add Visit Note for Today&apos;s Appointment</div>
      <div className={styles.body}>
        <div className={styles.text}>
          <span className={styles.title}>{title}</span>
          <span className={styles.meta}>{metaLine(appointment, title)}</span>
        </div>
        <Button variant="outline" size="sm" leadingIcon="solar:add-circle-linear" onClick={() => onAddVisitNote(title)}>
          Visit Note
        </Button>
      </div>
    </section>
  );
}
