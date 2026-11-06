import { useEffect, useMemo, useRef, useState } from 'react';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Badge } from '../../../components/Badge/Badge';
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
import { StickyNoteSheet } from './profile/StickyNoteSheet';
import { tagBadgeStyle } from '../../settings/member-leads/tags/contactTags';
import { usePatientTagList } from '../patient/usePatientTagList';
import { AfterCallSheet, MoreSheet, ProfileMenuSheet } from '../patient/ProfileSheets';
import { ContactConsentSheet } from '../patient/ContactConsentSheet';
import { InboxSheet } from '../patient/InboxSheet';
import { UploadPhotoSheet } from '../patient/UploadPhotoSheet';
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
// Only the top screen of the stack is mounted, so coming back from a
// workflow (Record Vitals, Add Medication...) remounts the profile. Keep
// each patient's tab and scroll so the provider lands where they left.
const lastView = new Map();
// Back in the app this long after tapping Call: offer to log the outreach.
const CALL_RETURN_MS = 3000;

/** A member's full mobile profile (Figma P360 759:26451 / 759:27431). */
export function MemberProfileScreen({ patientId, exact = false, tab: initialTab }) {
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
  const { callPhone, openThread, sendEmail, phone, email } = useContactActions(patient);
  const { tags: practiceTags } = usePatientTagList(pid);
  const [sheet, setSheet] = useState(null); // 'more' | 'menu' | 'inbox' | 'contactConsent' | 'sticky' | 'afterCall'
  const [photo, setPhoto] = useState(null);
  const cameraRef = useRef(null);
  const fileRef = useRef(null);
  const calledAt = useRef(0);
  const [saved] = useState(() => lastView.get(String(patientId)));
  const [tab, setTab] = useState(() => {
    const want = initialTab ?? saved?.tab;
    return TABS.some(t => t.key === want) ? want : 'summary';
  });
  const scrollRef = useRef(null);
  useEffect(() => {
    const el = scrollRef.current;
    const key = String(patientId);
    if (el && saved?.scroll) requestAnimationFrame(() => { el.scrollTop = saved.scroll; });
    return () => { lastView.set(key, { ...lastView.get(key), scroll: el?.scrollTop || 0 }); };
  }, [patientId, saved]);
  const pickTab = (next) => {
    setTab(next);
    const key = String(patientId);
    lastView.set(key, { ...lastView.get(key), tab: next });
  };
  // Ticks each minute so the due card's countdown and window stay current.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { fetchAllPatients(); }, [fetchAllPatients]);

  // tel: hands the call to the phone app; when the provider comes back,
  // offer to log it (desktop logs outreach after a call from the Outreach tab).
  useEffect(() => {
    const back = () => {
      if (document.visibilityState !== 'visible' || !calledAt.current) return;
      const away = Date.now() - calledAt.current;
      calledAt.current = 0;
      if (away >= CALL_RETURN_MS) setSheet('afterCall');
    };
    document.addEventListener('visibilitychange', back);
    return () => document.removeEventListener('visibilitychange', back);
  }, []);
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

  const minutes = due ? Math.round((due.start.getTime() - now) / 60000) : 0;
  // Membership follows the desktop banner's Set Active / Set Inactive:
  // a patient is Active unless their record says inactive.
  const status = patient.status ?? (tocPatients || []).find(p => String(p.id) === String(pid))?.status;
  const active = String(status || 'active').toLowerCase() !== 'inactive';
  const pcpLine = (
    <>
      {patient.pcp ? `PCP : ${patient.pcp} • ` : ''}Membership:{' '}
      <span className={active ? profile.active : profile.inactive}>{active ? 'Active' : 'Inactive'}</span>
    </>
  );
  const tagItems = [
    ...(patient.tags || []),
    ...practiceTags.map(t => <Badge key={`t-${t.id}`} size="md" variant="soft" label={t.name} style={tagBadgeStyle(t.color)} />),
  ];

  const call = () => { calledAt.current = Date.now(); callPhone(); };
  const tiles = [
    { key: 'call', label: 'Call', icon: 'solar:phone-linear', onClick: call, disabled: !phone },
    { key: 'chat', label: 'Chat', icon: 'solar:chat-round-linear', onClick: () => openThread('chat'), disabled: !patient.patientAppActive },
    { key: 'task', label: 'Task', icon: 'solar:checklist-minimalistic-linear', onClick: () => push('addTask', { patientId: patient.id, patientName: patient.name }) },
    { key: 'camera', label: 'Camera', icon: 'solar:camera-linear', onClick: () => cameraRef.current?.click() },
    { key: 'more', label: 'More', icon: 'solar:menu-dots-linear', onClick: () => setSheet('more') },
  ];
  const go = (key) => {
    const props = { patientId: pid };
    if (key === 'sms') openThread('sms');
    else if (key === 'email') sendEmail();
    else if (key === 'outreach') push('patientOutreach', props);
    else if (key === 'ccm') push('patientCcm', props);
    else if (key === 'note') push('patientNote', props);
    else if (key === 'vitals') push('patientVitals', props);
    else if (key === 'upload') fileRef.current?.click();
    else if (key === 'tags') push('patientTags', props);
    else if (key === 'consent') push('patientConsent', props);
    else setSheet(key);
  };
  const pickPhoto = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) setPhoto(file);
  };

  return (
    <div className={styles.screen}>
      <div ref={scrollRef} className={`${styles.body} ${profile.scroll}`}>
        <ContactHero
          name={p360?.chosen_name ? `${patient.name} (${p360.chosen_name})` : patient.name}
          pronoun={p360?.pronoun}
          meta={patientLine(patient)}
          details={[pcpLine]}
          tags={tagItems}
          actions={tiles}
          avatarActions={(
            <>
              <ActionButton icon="solar:inbox-linear" size="lg" aria-label="Inbox" onClick={() => setSheet('inbox')} />
              <ActionButton icon="solar:menu-dots-linear" size="lg" aria-label="Patient actions" onClick={() => setSheet('menu')} />
            </>
          )}
        />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden aria-label="Take a document photo" onChange={pickPhoto} />
        <input ref={fileRef} type="file" accept="image/*,.pdf" hidden aria-label="Choose a document" onChange={pickPhoto} />

        {due && (
          <div className={profile.due}>
            <Icon name={/virtual|tele/i.test(due.mode || '') ? 'solar:videocamera-record-linear' : 'solar:calendar-minimalistic-linear'} size={24} />
            <span className={profile.dueText}>
              <span className={profile.dueTitle}>Appointment due</span>
              <span className={profile.dueMeta}>{minutes > 0 ? `Starts in ${minutes} min` : minutes === 0 ? 'Starting now' : `Started ${-minutes} min ago`}</span>
            </span>
            <Button size="lg" variant="solid" onClick={() => push('appointment', { appointmentId: due.id })}>View</Button>
          </div>
        )}

        <div className={profile.tabs}>
          <SegmentedControl size="lg" aria-label="Profile sections" value={tab} onValueChange={pickTab} items={TABS} />
        </div>

        <div className={profile.tabBody}>
          {tab === 'summary' && <SummaryTab patientId={pid} />}
          {tab === 'programs' && <ProgramsTab patientId={pid} />}
          {tab === 'pami' && <PamiTab patientId={pid} />}
          {tab === 'tasks' && <PatientTasksTab patient={patient} />}
          {tab === 'profile' && <DemographicsTab patient={patient} p360={p360} />}
        </div>
      </div>

      {sheet === 'more' && <MoreSheet phone={phone} email={email} onPick={go} onClose={() => setSheet(null)} />}
      {sheet === 'menu' && <ProfileMenuSheet onPick={go} onClose={() => setSheet(null)} />}
      {sheet === 'inbox' && <InboxSheet patient={patient} onClose={() => setSheet(null)} />}
      {sheet === 'contactConsent' && <ContactConsentSheet patient={patient} onClose={() => setSheet(null)} />}
      {sheet === 'sticky' && <StickyNoteSheet patientId={pid} note={null} onClose={() => setSheet(null)} />}
      {sheet === 'afterCall' && (
        <AfterCallSheet name={patient.name} onLog={() => push('patientOutreach', { patientId: pid, type: 'Call' })} onClose={() => setSheet(null)} />
      )}
      {photo && <UploadPhotoSheet patient={patient} file={photo} onClose={() => setPhoto(null)} />}
    </div>
  );
}
