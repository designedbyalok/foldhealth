import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../components/Button/Button';
import { Icon } from '../../../components/Icon/Icon';
import { SegmentedControl } from '../../../components/SegmentedControl/SegmentedControl';
import { useAppStore } from '../../../store/useAppStore';
import { ContactHero } from '../ContactHero';
import { MobileEmpty } from '../MobileParts';
import { useMobileNav } from '../MobileNavContext';
import { useContactActions } from '../useContactActions';
import { ProgramsTab } from '../care/ProgramsTab';
import { resolveAllPatient } from './resolvePatient';
import { appointmentStart } from '../schedule/appointmentTime';
import { patientLine } from '../mobileFormat';
import { SummaryTab } from './profile/SummaryTab';
import { PamiTab } from './profile/PamiTab';
import { PatientTasksTab } from './profile/PatientTasksTab';
import { DemographicsTab } from './profile/DemographicsTab';
import styles from '../mobile.module.css';
import profile from './MemberProfileScreen.module.css';

// Figma P360 tab strip (759:26451: Summary, PAMI, Task, Demographics), with
// care programs and plans as their own tab.
const TABS = [
  { key: 'summary', label: 'Summary' },
  { key: 'programs', label: 'Programs' },
  { key: 'pami', label: 'PAMI' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'profile', label: 'Profile' },
];
const SOON_MS = 30 * 60000;

/** A member's full mobile profile (Figma P360 759:26451 / 759:27431). */
export function MemberProfileScreen({ patientId, exact = false, tab: initialTab = 'summary' }) {
  const { push } = useMobileNav();
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
  const appointments = useAppStore(s => s.appointments);
  const fetchP360Profile = useAppStore(s => s.fetchP360Profile);
  const fetchAppointments = useAppStore(s => s.fetchAppointments);
  const fetchAllPatients = useAppStore(s => s.fetchAllPatients);
  const { actions, callPhone, phone } = useContactActions(patient);
  const [tab, setTab] = useState(TABS.some(t => t.key === initialTab) ? initialTab : 'summary');
  // Ticks each minute so the due card's countdown and window stay current.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { fetchAllPatients(); }, [fetchAllPatients]);
  useEffect(() => {
    if (pid == null) return;
    fetchP360Profile?.(pid);
    fetchAppointments?.();
  }, [pid, fetchP360Profile, fetchAppointments]);

  // Figma "Appointment due · Join Call": a visit for this patient starting
  // within 30 minutes (or started in the last 30).
  const due = useMemo(() => (appointments || [])
    .filter(a => String(a.patient_id) === String(pid) && !/cancel/i.test(a.status || ''))
    .map(a => ({ ...a, start: appointmentStart(a) }))
    .filter(a => a.start && Math.abs(a.start.getTime() - now) <= SOON_MS)
    .sort((a, b) => Math.abs(a.start.getTime() - now) - Math.abs(b.start.getTime() - now))[0], [appointments, pid, now]);

  if (!patient) {
    return (
      <div className={styles.screen}>
        <ContactHero name="Member" />
        <MobileEmpty icon="solar:user-cross-linear" title="Member not found" />
      </div>
    );
  }

  const pcpLine = [patient.pcp ? `PCP : ${patient.pcp}` : '', patient.activeCareProgram || ''].filter(Boolean).join(' • ');
  const minutes = due ? Math.round((due.start.getTime() - now) / 60000) : 0;

  return (
    <div className={styles.screen}>
      <div className={`${styles.body} ${profile.scroll}`}>
        <ContactHero
          name={p360?.chosen_name ? `${patient.name} (${p360.chosen_name})` : patient.name}
          pronoun={p360?.pronoun}
          meta={[patientLine(patient), pcpLine].filter(Boolean).join('\n')}
          tags={patient.tags || []}
          phone={phone}
          onCallPhone={callPhone}
          actions={actions}
        />

        {due && (
          <div className={profile.due}>
            <Icon name={/virtual|tele/i.test(due.mode || '') ? 'solar:videocamera-record-linear' : 'solar:calendar-minimalistic-linear'} size={24} />
            <span className={profile.dueText}>
              <span className={profile.dueTitle}>Appointment due</span>
              <span className={profile.dueMeta}>{minutes > 0 ? `Starts in ${minutes} min` : minutes === 0 ? 'Starting now' : `Started ${-minutes} min ago`}</span>
            </span>
            <Button variant="solid" onClick={() => push('appointment', { appointmentId: due.id })}>View</Button>
          </div>
        )}

        <div className={profile.tabs}>
          <SegmentedControl size="lg" aria-label="Profile sections" value={tab} onValueChange={setTab} items={TABS} />
        </div>

        <div className={profile.tabBody}>
          {tab === 'summary' && <SummaryTab patientId={pid} />}
          {tab === 'programs' && <ProgramsTab patientId={pid} />}
          {tab === 'pami' && <PamiTab patientId={pid} />}
          {tab === 'tasks' && <PatientTasksTab patient={patient} />}
          {tab === 'profile' && <DemographicsTab patient={patient} p360={p360} />}
        </div>
      </div>
    </div>
  );
}
