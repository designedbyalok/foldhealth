import { useEffect, useRef, useState } from 'react';
import { Drawer } from '../../../components/Drawer/Drawer';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Avatar } from '../../../components/Avatar/Avatar';
import { Badge } from '../../../components/Badge/Badge';
import { Icon } from '../../../components/Icon/Icon';
import { Link } from '../../../components/Link/Link';
import { MenuPopover } from '../../../components/MenuPopover/MenuPopover';
import { SearchBar } from '../../../components/SearchBar/SearchBar';
import { Select } from '../../../components/Select/Select';
import { toast } from '../../../components/Toast/sonnerToast';
import { TruncatedText } from '../../../components/TruncatedText/TruncatedText';
import { useAppStore } from '../../../store/useAppStore';
import { initialsOf } from '../../ooo/oooUtils';
import { dateLabel, STATUS_OPTIONS, statusBlockedReason, statusLabel, timeRangeLabel } from './appointmentList';
import styles from './AppointmentListView.module.css';

/**
 * Group appointment details (after the legacy Appointment Details for a group
 * session), in two panels. Left: the session (its name, Copy Event ID, total
 * members, type, date and time, providers, description, department) and its
 * status, set for every member at once. Right: Tracking, its members,
 * searchable, each with sex, DOB, email and phone from their patient record,
 * their status, and actions: open their quick view, check them in, or set any
 * status from "...".
 *
 * @param {object}   props.session        – the session row (type, provider, date, location, reason)
 * @param {object[]} props.members        – its appointments, one per member
 * @param {object}   props.statusTone     – status → Badge tone
 * @param {(appt, status) => void} props.onStatusChange          – one member
 * @param {(appts, status) => void} props.onSessionStatusChange  – every member
 * @param {() => void} props.onClose
 */
export function GroupAppointmentDrawer({ session, members, statusTone, onStatusChange, onSessionStatusChange, onClose }) {
  const openQuickView = useAppStore(s => s.openQuickView);
  const patients = useAppStore(s => s.allPatients);
  const fetchAllPatients = useAppStore(s => s.fetchAllPatients);
  useEffect(() => { if (!patients?.length) fetchAllPatients?.(); }, [patients?.length, fetchAllPatients]);
  // A member's patient record (by id, else by name) for their contact lines.
  const recordOf = (a) => (patients || []).find(p => (a.patient_id && String(p.id) === String(a.patient_id))
    || String(p.name || '').toLowerCase() === String(a.patient_name || '').toLowerCase());
  const [menu, setMenu] = useState(null); // the member whose "..." is open
  const menuAnchor = useRef(null);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = q ? members.filter(a => String(a.patient_name || '').toLowerCase().includes(q)) : members;
  const secondary = (session.secondary_users || []).map(u => (typeof u === 'string' ? u : u?.name)).filter(Boolean).join(', ');
  const details = [
    { label: 'Appointment Type', icon: 'solar:users-group-rounded-linear', value: session.appointment_type_name },
    { label: 'Date & Time', icon: 'solar:calendar-linear', value: `${dateLabel(session.date)}, ${timeRangeLabel(session)}`, recurring: !!session.recurring },
    { label: 'Primary Provider', icon: 'solar:user-linear', value: session.primary_user },
    { label: 'Secondary Provider', icon: 'solar:user-linear', value: secondary },
    { label: 'Description', icon: 'solar:document-text-linear', value: session.reason_for_visit },
    { label: 'Department', icon: 'solar:map-point-linear', value: session.location },
  ].filter(d => d.value);

  // The session's status: everyone's, when they share one. Picking one sets it
  // for every member; one any member can't take yet is greyed out, with why.
  const statuses = [...new Set(members.map(statusLabel))];
  const sessionStatus = statuses.length === 1 ? statuses[0] : undefined;
  const sessionOptions = STATUS_OPTIONS.map((s) => {
    const blocked = s === sessionStatus ? [] : members.filter(a => statusBlockedReason(a, s));
    if (!blocked.length) return { value: s, label: s };
    const count = blocked.length === members.length ? 'No member qualifies yet' : `${blocked.length} of ${members.length} members don't qualify yet`;
    return { value: s, label: s, disabled: true, tooltip: `${statusBlockedReason(blocked[0], s)}. ${count}.` };
  });

  const copyEventId = async () => {
    try {
      await navigator.clipboard.writeText(members.map(a => a.id).join(', '));
      toast.success('Event ID Copied Successfully');
    } catch {
      toast.error('Event ID could not be copied. Try again.');
    }
  };

  return (
    <Drawer title="Appointment Details" onClose={onClose} width={1000}>
      <div className={styles.groupDrawer}>
        <div className={styles.sessionMeta}>
          <div className={styles.sessionHead}>
            <Avatar variant="patient" size="L" initials={initialsOf(session.appointment_type_name)} />
            <span className={styles.sessionTitle}>
              <span className={styles.sessionName}>{session.appointment_type_name || 'Group Appointment'}</span>
              <Link variant="primary" className={styles.copyLink} onClick={copyEventId}>
                <Icon name="solar:copy-linear" size={14} />
                Copy Event ID
              </Link>
            </span>
          </div>
          <div className={styles.totalMembers}>Total Members: {members.length}</div>
          {details.map(d => (
            <div key={d.label} className={styles.sessionMetaRow}>
              <span className={styles.sessionMetaLabel}>{d.label}</span>
              <span className={styles.sessionMetaValue}>
                <Icon name={d.icon} size={16} color="var(--neutral-300)" />
                <TruncatedText text={d.value} />
                {d.recurring && <Badge size="sm" tone="primary" variant="outline" icon="solar:repeat-linear" label="Recurring" />}
              </span>
            </div>
          ))}
          <div className={styles.sessionMetaRow}>
            <Select
              label="Appointment Status"
              placeholder="Mixed"
              options={sessionOptions}
              value={sessionStatus}
              onChange={(next) => onSessionStatusChange(members, next)}
              leadingIcon="solar:history-linear"
              portal
            />
          </div>
        </div>

        <div className={styles.trackingPanel}>
          <div className={styles.trackingHead}>
            <h3 className={styles.trackingTitle}>Tracking</h3>
            <SearchBar value={query} onChange={e => setQuery(e.target.value)} placeholder="Search members" autoFocus={false} fullWidth />
          </div>
          <div className={styles.trackingList}>
            {!shown.length && <div className={styles.membersEmpty}>No members match this search</div>}
            {shown.map((a) => {
              const status = statusLabel(a);
              const rec = recordOf(a);
              const sexDob = [rec?.gender ? String(rec.gender)[0].toUpperCase() : '', rec?.dob].filter(Boolean).join(', ');
              const checkInBlocked = statusBlockedReason(a, 'Checked In');
              const checkedIn = status === 'Checked In' || status === 'Checked Out';
              return (
                <div key={a.id} className={styles.trackingRow}>
                  <Avatar variant="patient" size="L" initials={initialsOf(a.patient_name)} />
                  <span className={styles.trackingInfo}>
                    <span className={styles.memberName}>{a.patient_name || 'Member'}</span>
                    {sexDob && <span className={styles.trackingSub}>({sexDob})</span>}
                    {rec?.email && <span className={styles.trackingSub}>{rec.email}</span>}
                    {rec?.phone && <span className={styles.trackingSub}>{rec.phone}</span>}
                    <span className={styles.trackingStatus}><Badge size="sm" tone={statusTone[status] || 'neutral'} label={status} /></span>
                  </span>
                  <span className={styles.memberActions}>
                    <ActionButton
                      icon="solar:arrow-right-up-linear"
                      size="sm"
                      tooltip="Open member"
                      onClick={() => openQuickView({ id: a.patient_id, memberId: a.patient_id, name: a.patient_name, initials: initialsOf(a.patient_name) })}
                    />
                    <ActionButton
                      size="sm"
                      tooltip={checkedIn ? status : checkInBlocked || 'Check in'}
                      tooltipLeft
                      disabled={checkedIn || !!checkInBlocked}
                      onClick={() => onStatusChange(a, 'Checked In')}
                    >
                      <Icon name="solar:check-circle-linear" size={16} color={checkedIn ? 'var(--status-success)' : undefined} />
                    </ActionButton>
                    <ActionButton
                      icon="solar:menu-dots-linear"
                      size="sm"
                      tooltip="Change status"
                      tooltipLeft
                      active={menu?.id === a.id}
                      onClick={(e) => { menuAnchor.current = e.currentTarget; setMenu(a); }}
                    />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {menu && (
        <MenuPopover
          anchorRef={menuAnchor}
          ariaLabel="Change status"
          width="auto"
          items={[{ section: 'Change Status' }, ...STATUS_OPTIONS.map((st) => {
            const current = statusLabel(menu);
            const why = st === current ? null : statusBlockedReason(menu, st);
            return { key: st, label: st, selected: st === current, disabled: !!why, tooltip: why || undefined };
          })]}
          onSelect={(st) => onStatusChange(menu, st)}
          onClose={() => setMenu(null)}
        />
      )}
    </Drawer>
  );
}
