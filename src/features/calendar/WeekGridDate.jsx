import styles from './CalendarView.module.css';

/**
 * Week header cell, as in User Availability: the weekday, then the date
 * ("Friday" / "Nov 20"), so a week across two months reads clearly.
 * schedule-x renders it inside each `.sx__week-grid__date` with the ISO day.
 */
export function WeekGridDate({ date }) {
  const [y, m, d] = String(date).split('-').map(Number);
  const day = new Date(y, m - 1, d);
  return (
    <span className={styles.weekHead}>
      <span>{day.toLocaleDateString('en-US', { weekday: 'long' })}</span>
      <span className={styles.weekHeadDate}>{day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
    </span>
  );
}
