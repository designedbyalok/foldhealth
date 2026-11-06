import { useEffect, useMemo, useState } from 'react';
import { Avatar } from '../../../components/Avatar/Avatar';
import { Icon } from '../../../components/Icon/Icon';
import { useAppStore } from '../../../store/useAppStore';
import { usePatientCareTeam } from '../../patient/care-team/usePatientCareTeam';
import { ContactHero } from '../ContactHero';
import { MobileEmpty } from '../MobileParts';
import { useContactActions } from '../useContactActions';
import { resolveAllPatient } from './resolvePatient';
import { appointmentStart } from '../schedule/appointmentTime';
import { initialsOf, patientLine } from '../mobileFormat';
import styles from '../mobile.module.css';
import profile from './MemberProfileScreen.module.css';

/** A member's summary: identity, quick actions, notes, visits, care team (Figma 759:19971). */
export function MemberProfileScreen({ patientId, exact = false }) {
  // Links may carry another id space (TOC patient id, member id). Resolved
  // only when the patient lists change, not on every store update.
  const allPatients = useAppStore(s => s.allPatients);
  const tocPatients = useAppStore(s => s.patients);
  const patient = useMemo(
    () => (exact
      ? (allPatients || []).find(p => String(p.id) === String(patientId)) || null
      : resolveAllPatient({ allPatients, patients: tocPatients }, { id: patientId })),
    [allPatients, tocPatients, patientId, exact],
  );
  const pid = patient?.id ?? patientId;
  const p360 = useAppStore(s => s.p360ProfilesById?.[pid]);
  const notes = useAppStore(s => s.stickyNotes);
  const appointments = useAppStore(s => s.appointments);
  const fetchP360Profile = useAppStore(s => s.fetchP360Profile);
  const fetchStickyNotes = useAppStore(s => s.fetchStickyNotes);
  const fetchAppointments = useAppStore(s => s.fetchAppointments);
  const fetchAllPatients = useAppStore(s => s.fetchAllPatients);
  useEffect(() => { fetchAllPatients(); }, [fetchAllPatients]);
  const { team } = usePatientCareTeam(pid);
  const { actions, callPhone, phone } = useContactActions(patient);

  useEffect(() => {
    if (pid == null) return;
    fetchP360Profile?.(pid);
    fetchStickyNotes?.(pid);
    fetchAppointments?.();
  }, [pid, fetchP360Profile, fetchStickyNotes, fetchAppointments]);

  const myNotes = (notes || []).filter(n => String(n.patient_id) === String(pid));
  const [now] = useState(() => Date.now());
  const upcoming = useMemo(() => {
    return (appointments || [])
      .filter(a => String(a.patient_id) === String(pid))
      .map(a => ({ ...a, start: appointmentStart(a) }))
      .filter(a => a.start && a.start.getTime() >= now && !/cancel/i.test(a.status || ''))
      .sort((a, b) => a.start - b.start)
      .slice(0, 3);
  }, [appointments, pid, now]);

  if (!patient) {
    return (
      <div className={styles.screen}>
        <ContactHero name="Member" />
        <MobileEmpty icon="solar:user-cross-linear" title="Member not found" />
      </div>
    );
  }

  const pcpLine = [patient.pcp ? `PCP : ${patient.pcp}` : '', patient.activeCareProgram || ''].filter(Boolean).join(' • ');

  return (
    <div className={styles.screen}>
      <div className={styles.body}>
        <ContactHero
          name={p360?.chosen_name ? `${patient.name} (${p360.chosen_name})` : patient.name}
          pronoun={p360?.pronoun}
          meta={[patientLine(patient), pcpLine].filter(Boolean).join('\n')}
          tags={patient.tags || []}
          phone={phone}
          onCallPhone={callPhone}
          actions={actions}
        />

        <Section title="Sticky Notes">
          {myNotes.length === 0 ? <p className={profile.empty}>No sticky notes</p> : myNotes.map(n => (
            <div key={n.id} className={profile.note}>
              <p className={profile.noteText}>{n.text}</p>
              <p className={profile.noteMeta}>{[n.author_name, n.author_date].filter(Boolean).join(' • ')}</p>
            </div>
          ))}
        </Section>

        <Section title="Upcoming Appointments">
          {upcoming.length === 0 ? <p className={profile.empty}>No upcoming appointments</p> : upcoming.map(a => (
            <div key={a.id} className={styles.card}>
              <Avatar variant="provider" size="L" initials={initialsOf(a.primary_user)} />
              <span className={styles.cardText}>
                <span className={styles.primaryText}>{a.appointment_type_name || 'Appointment'}</span>
                <span className={styles.secondaryText}>{[`${a.date}, ${a.time_start}${a.time_end ? ` - ${a.time_end}` : ''}`].join('')}</span>
                {(a.primary_user || a.location) && (
                  <span className={styles.secondaryText}>{[a.primary_user, a.location].filter(Boolean).join(' • ')}</span>
                )}
              </span>
            </div>
          ))}
        </Section>

        <Section title="Primary Care Team">
          {team.length === 0 ? <p className={profile.empty}>No care team yet</p> : (
            <div className={profile.team}>
              {team.map(m => (
                <div key={m.id || m.userId} className={profile.member}>
                  <Avatar variant="staff" size="L" initials={m.initials || initialsOf(m.name)} />
                  <span className={styles.cardText}>
                    <span className={styles.primaryText}>{m.name}</span>
                    <span className={styles.secondaryText}>{m.title || m.role}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className={profile.section}>
      <h2 className={profile.sectionTitle}>
        {title}
        <Icon name="solar:alt-arrow-down-linear" size={16} />
      </h2>
      <div className={profile.sectionBody}>{children}</div>
    </section>
  );
}
