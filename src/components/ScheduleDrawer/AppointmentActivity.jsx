import { useEffect, useState } from 'react';
import { ActivityLog } from '../ActivityLog/ActivityLog';
import { Avatar } from '../Avatar/Avatar';
import { Tabs } from '../Tabs/Tabs';
import { useAppStore } from '../../store/useAppStore';
import { displayAppointmentStatus, getInitials } from './scheduleDrawerConstants';
import styles from './ScheduleDrawer.module.css';

const FIELD_LABEL = {
  status: 'Status',
  primary_user: 'Provider',
  mode: 'Mode of Appointment',
  location: 'Location',
  appointment_type_name: 'Appointment Type',
  reason_for_visit: 'Reason for Visit',
  date: 'Date',
  time: 'Time',
};
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const initials = (name) => getInitials(name || '?').toUpperCase();
const shown = (field, v) => (v === '' || v == null ? 'None' : field === 'date' ? String(v).replace(/-/g, '/') : field === 'status' ? displayAppointmentStatus(v) : String(v));

// `change` isn't one of ActivityLog's typed variants, so it gets the generic
// body (headline over the outcome line); `note` would render a note card.
/**
 * An audit row → ActivityLog entries in its own variants: Appointment
 * Created; status → the status transition; provider and any other field →
 * a generic entry with "from → to" (a reassignment reads "{who} reassigned
 * the appointment"). The rail is the person's
 * initials; the meta line carries the date, time and who; why a
 * reassignment happened goes in the headline's brackets.
 */
function toEntries(log) {
  const d = new Date(log.createdAt);
  const who = log.user || 'System';
  // The rail shows who did it, as their initials, level with the line that
  // names them (the headline), not the date line above it.
  const avatar = <span className={styles.activityRailAvatar}><Avatar variant="staff" size="S" initials={initials(who)} /></span>;
  const meta = Number.isNaN(d.getTime()) ? { by: who, avatar } : {
    avatar,
    when: log.createdAt,
    date: d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
    by: who,
  };
  if (log.action === 'created') return [{ ...meta, t: 'create', title: 'Appointment Created' }];
  const why = /\((.+)\)$/.exec(log.details || '')?.[1];
  const tail = why ? ` (${why})` : '';
  // Only real changes (a bulk edit logs every field it set, changed or not).
  const changes = (log.changes || []).filter(c => FIELD_LABEL[c.field] && String(c.from ?? '') !== String(c.to ?? ''));
  if (!changes.length) return log.changes?.length ? [] : [{ ...meta, t: 'change', title: log.details || 'Appointment Updated' }];
  return changes.map((c) => {
    if (c.field === 'status') {
      return { ...meta, t: 'status_change', title: `Status Changed${tail}`, from: shown('status', c.from || 'Scheduled'), to: shown('status', c.to) };
    }
    if (c.field === 'primary_user') {
      // Who it moved from and to, as plain names in a lighter grey (no
      // avatars). A reassignment reads as what this person did; their name
      // is in the headline, so the meta line drops it.
      const moved = { outcome: `${shown('primary_user', c.from)} → ${shown('primary_user', c.to)}`, outcomeColor: 'var(--neutral-300)' };
      if (log.action === 'reassigned') {
        return { ...meta, ...moved, by: null, t: 'change', title: `${who} reassigned the appointment${tail}` };
      }
      return { ...meta, ...moved, t: 'change', title: 'Provider Changed' };
    }
    return { ...meta, t: 'change', title: `${FIELD_LABEL[c.field]} ${c.from === '' || c.from == null ? 'Added' : 'Changed'}${tail}`, outcome: `${shown(c.field, c.from)} → ${shown(c.field, c.to)}` };
  });
}

/**
 * Activity / Automations for an appointment, read from the audit log
 * (`audit_logs`, entity "Appointment"). Refetched whenever the appointments
 * reload (each save does), so a change shows straight away.
 *
 * @param {object} props
 * @param {string} props.appointmentId
 */
export function AppointmentActivity({ appointmentId }) {
  const fetchAuditLogs = useAppStore(s => s.fetchAuditLogs);
  const appointments = useAppStore(s => s.appointments);
  const [tab, setTab] = useState('activity');
  const [logs, setLogs] = useState([]);
  useEffect(() => {
    if (!appointmentId) return undefined;
    let live = true;
    fetchAuditLogs?.('Appointment', appointmentId).then(rows => { if (live) setLogs(rows || []); });
    return () => { live = false; };
  }, [appointmentId, appointments, fetchAuditLogs]);

  // Newest first, under a month header.
  const entries = [];
  let month = '';
  [...logs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).forEach((log) => {
    const d = new Date(log.createdAt);
    const label = Number.isNaN(d.getTime()) ? '' : `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    if (label && label !== month) { entries.push({ t: 'group', label }); month = label; }
    entries.push(...toEntries(log));
  });

  return (
    <div className={styles.section}>
      <Tabs
        variant="pill"
        items={[{ key: 'activity', label: 'Activity' }, { key: 'automation', label: 'Automations' }]}
        value={tab}
        onValueChange={setTab}
      />
      {tab === 'activity'
        ? <ActivityLog entries={entries} emptyLabel="No activity recorded yet." flushTop />
        : <ActivityLog entries={[]} emptyLabel="No automations have run for this appointment yet." />}
    </div>
  );
}
