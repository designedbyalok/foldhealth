import { Icon } from '../../../components/Icon/Icon';
import { Link } from '../../../components/Link/Link';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import { apptDate } from './cisAppointments';
import { fmtDate } from './cisStatusConfig';
import styles from './DoseAppointmentChip.module.css';

/**
 * A booked vaccine appointment on a dose, as link text: "Scheduled <date>" before the
 * visit, "Confirm <date>" once it has passed with the dose still
 * unrecorded. Click to edit or cancel the appointment.
 *
 * @param {object}   props
 * @param {{ appt: object, passed: boolean } | null} props.match – appointmentForDose()
 * @param {function} props.onOpen – (appt) => void
 */
export function DoseAppointmentChip({ match, onOpen }) {
  if (!match) return null;
  const { appt, passed } = match;
  const date = fmtDate(apptDate(appt));
  // Short on the chip so it fits the date column; the tooltip has the year.
  const short = date.slice(0, 5);
  const tip = [
    `${passed ? 'Appointment was on' : 'Appointment on'} ${date}${appt.time ? ` at ${appt.time}` : ''}`,
    appt.provider,
    passed ? 'Record the date given, or reschedule.' : null,
    appt.bookedByName ? `Booked by ${appt.bookedByName}` : null,
  ].filter(Boolean).join('. ');
  const open = () => onOpen(appt);
  return (
    <Tooltip label={tip} variant="light" maxWidth={260}>
      <Link
        role="button"
        tabIndex={0}
        className={`${styles.link} ${passed ? styles.confirm : ''}`}
        onClick={open}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }}
        aria-label={`${passed ? 'Confirm dose given, appointment was' : 'Scheduled'} ${date}. Edit appointment`}
      >
        <Icon name="solar:calendar-add-linear" size={12} color="currentColor" />
        {passed ? `Confirm ${short}` : `Scheduled ${short}`}
      </Link>
    </Tooltip>
  );
}
