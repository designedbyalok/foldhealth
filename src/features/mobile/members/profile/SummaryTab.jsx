import { useEffect, useMemo, useState } from 'react';
import { Avatar } from '../../../../components/Avatar/Avatar';
import { Badge } from '../../../../components/Badge/Badge';
import { displayAppointmentStatus } from '../../../../components/ScheduleDrawer/scheduleDrawerConstants';
import { useAppStore } from '../../../../store/useAppStore';
import { usePatientCareTeam } from '../../../patient/care-team/usePatientCareTeam';
import { useMobileNav } from '../../MobileNavContext';
import { initialsOf } from '../../mobileFormat';
import { appointmentStart } from '../../schedule/appointmentTime';
import { ProfileEmpty, ProfileSection } from './ProfileSection';
import { StickyNoteSheet } from './StickyNoteSheet';
import common from '../../mobile.module.css';
import styles from '../MemberProfileScreen.module.css';

const EMPTY = [];

/** Figma P360 Summary: sticky notes, visits, care team, family (759:26451). */
export function SummaryTab({ patientId }) {
  const { push } = useMobileNav();
  const notes = useAppStore(s => s.stickyNotes);
  const appointments = useAppStore(s => s.appointments);
  const family = useAppStore(s => s.familyMembers?.[String(patientId)] || EMPTY);
  const fetchStickyNotes = useAppStore(s => s.fetchStickyNotes);
  const fetchAppointments = useAppStore(s => s.fetchAppointments);
  const fetchFamilyMembers = useAppStore(s => s.fetchFamilyMembers);
  const { team } = usePatientCareTeam(patientId);
  const [editing, setEditing] = useState(null); // null | {} | note
  const [now] = useState(() => Date.now());

  useEffect(() => {
    if (patientId == null) return;
    fetchStickyNotes?.(patientId);
    fetchAppointments?.();
    fetchFamilyMembers?.(patientId);
  }, [patientId, fetchStickyNotes, fetchAppointments, fetchFamilyMembers]);

  const myNotes = (notes || []).filter(n => String(n.patient_id) === String(patientId));
  const upcoming = useMemo(() => (appointments || [])
    .filter(a => String(a.patient_id) === String(patientId))
    .map(a => ({ ...a, start: appointmentStart(a) }))
    .filter(a => a.start && a.start.getTime() >= now - 30 * 60000 && !/cancel/i.test(a.status || ''))
    .sort((a, b) => a.start - b.start)
    .slice(0, 5), [appointments, patientId, now]);

  return (
    <>
      <ProfileSection title="Sticky Notes" count={myNotes.length || null} onAdd={() => setEditing({})} addLabel="Add sticky note">
        {myNotes.length === 0 ? <ProfileEmpty>No sticky notes</ProfileEmpty> : myNotes.map(n => (
          <button key={n.id} type="button" className={styles.note} onClick={() => setEditing(n)}>
            <span className={styles.noteText}>{n.text}</span>
            <span className={styles.noteMeta}>{[n.author_name, n.author_date].filter(Boolean).join(' • ')}</span>
          </button>
        ))}
      </ProfileSection>

      <ProfileSection title="Upcoming Appointments" count={upcoming.length || null}>
        {upcoming.length === 0 ? <ProfileEmpty>No upcoming appointments</ProfileEmpty> : upcoming.map(a => (
          <button key={a.id} type="button" className={common.card} onClick={() => push('appointment', { appointmentId: a.id })}>
            <Avatar variant="provider" size="L" initials={initialsOf(a.primary_user)} />
            <span className={common.cardText}>
              <span className={common.primaryText}>{a.appointment_type_name || 'Appointment'}</span>
              <span className={common.secondaryText}>{`${a.date}, ${a.time_start}${a.time_end ? ` - ${a.time_end}` : ''}`}</span>
              {(a.primary_user || a.location) && (
                <span className={common.secondaryText}>{[a.primary_user, a.location].filter(Boolean).join(' • ')}</span>
              )}
            </span>
            <Badge size="sm" tone="neutral" variant="soft" label={displayAppointmentStatus(a.status)} />
          </button>
        ))}
      </ProfileSection>

      <ProfileSection title="Primary Care Team" count={team.length || null}>
        {team.length === 0 ? <ProfileEmpty>No care team yet</ProfileEmpty> : (
          <div className={styles.group}>
            {team.map(m => (
              <div key={m.id || m.userId || m.name} className={styles.groupRow}>
                <Avatar variant="staff" size="L" initials={m.initials || initialsOf(m.name)} />
                <span className={common.cardText}>
                  <span className={common.primaryText}>{m.name}</span>
                  <span className={common.secondaryText}>{m.title || m.role}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </ProfileSection>

      <ProfileSection title="Family & Caregivers" count={family.length || null}>
        {family.length === 0 ? <ProfileEmpty>No family or caregivers added</ProfileEmpty> : (
          <div className={styles.group}>
            {family.map(f => (
              <div key={f.id} className={styles.groupRow}>
                <Avatar variant="patient" size="L" initials={initialsOf(f.name)} />
                <span className={common.cardText}>
                  <span className={common.primaryText}>{f.name}</span>
                  <span className={common.secondaryText}>
                    {[f.relationship, f.isCaregiver ? 'Caregiver' : '', f.isEmergencyContact ? 'Emergency contact' : ''].filter(Boolean).join(' • ')}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </ProfileSection>

      {editing && <StickyNoteSheet patientId={patientId} note={editing.id ? editing : null} onClose={() => setEditing(null)} />}
    </>
  );
}
