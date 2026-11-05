import { useAppStore } from '../../store/useAppStore';
import { Drawer } from '../Drawer/Drawer';
import { Icon } from '../Icon/Icon';
import { CloseButton } from '../CloseButton/CloseButton';
import { PatientP360Banner } from '../../features/patient/shell/PatientP360Banner/PatientP360Banner';
import { PatientProfileTabs } from '../../features/patient/left-panel/PatientProfileTabs/PatientProfileTabs';
import styles from './QuickViewDrawer.module.css';

/**
 * The patient a quick view shows: the snapshot it was opened with, with the
 * live slice row merged over it.
 *
 * The snapshot is whatever the opening row passed at click time, it goes
 * stale the moment the Update Member drawer saves. Merge the live slice
 * row (matched by id, then by memberId) over it so the banner always
 * shows current name / dob / gender / age. HEDIS members are real Fold
 * patients (ids like ap-001/FOLD...), so they must be checked before the
 * generic allPatients fallback or the synthetic hd1 names would be
 * overwritten by a colliding Fold ID.
 */
function useQuickViewPatient(snapshot) {
  const live = useAppStore(s => {
    if (!snapshot) return null;
    const matches = (m) => m && (m.id === snapshot.id || (snapshot.memberId != null && String(m.memberId) === String(snapshot.memberId)));
    return (s.hedisMembers || []).find(matches)
      || s.patients.find(matches)
      || (s.allPatients || []).find(matches)
      || s.hccMembers.find(matches)
      || (s.awvMembers || []).find(matches)
      || (s.ccmWorklistMembers || []).find(matches)
      || (s.snpWorklistMembers || []).find(matches)
      || null;
  });
  if (!snapshot) return null;
  return live
    ? {
        ...snapshot,
        name: live.name ?? snapshot.name,
        initials: live.initials ?? live.in ?? snapshot.initials,
        gender: live.gender ?? live.g ?? snapshot.gender,
        age: live.age ?? snapshot.age,
        dob: live.dob ?? snapshot.dob,
        language: live.language ?? snapshot.language,
      }
    : snapshot;
}

function ViewFullProfile({ patient, onClose }) {
  const navigateToPatient = useAppStore(s => s.navigateToPatient);
  return (
    <button className={styles.profileLink} onClick={() => { onClose(); navigateToPatient(patient.id); }}>
      View Full Profile
      <Icon name="solar:arrow-right-linear" size={16} />
    </button>
  );
}

function QuickViewBody({ patient }) {
  return (
    <>
      <div className={styles.stickyTop}>
        <PatientP360Banner patient={patient} variant="drawer" />
      </div>
      <div className={styles.tabsPanel}>
        <PatientProfileTabs patientId={patient.id} patient={patient} variant="drawer" />
      </div>
    </>
  );
}

/** Quick view over the page, opened from a worklist row (store: quickViewPatient). */
export function QuickViewDrawer() {
  const snapshot = useAppStore(s => s.quickViewPatient);
  const closeQuickView = useAppStore(s => s.closeQuickView);
  const patient = useQuickViewPatient(snapshot);
  if (!patient) return null;

  const headerRight = (
    <>
      <ViewFullProfile patient={patient} onClose={closeQuickView} />
      <span className={styles.headerDivider} />
    </>
  );

  return (
    <Drawer
      title="Quick View"
      onClose={closeQuickView}
      headerRight={headerRight}
      noCloseDivider
      headerStyle={{ padding: '12px', borderBottom: '0.5px solid var(--neutral-150)' }}
      titleStyle={{ fontSize: 'var(--font-base)' }}
      bodyClassName={styles.drawerBody}
    >
      <QuickViewBody patient={patient} />
    </Drawer>
  );
}

/**
 * The same quick view docked beside a page's content instead of over it
 * (P360 Revamp 1060:273126: the patient's profile next to their
 * conversation). The caller places it and decides when it shows.
 *
 * @param {object}   props.patient  – snapshot: { id, name, initials, gender, age, memberId, … }
 * @param {() => void} props.onClose
 */
export function QuickViewPanel({ patient: snapshot, onClose }) {
  const patient = useQuickViewPatient(snapshot);
  if (!patient) return null;
  return (
    <aside className={styles.panel} aria-label="Quick View">
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>Quick View</span>
        <ViewFullProfile patient={patient} onClose={onClose} />
        <span className={styles.headerDivider} />
        <CloseButton size={16} label="Close quick view" onClick={onClose} />
      </div>
      <div className={styles.panelBody}>
        <QuickViewBody patient={patient} />
      </div>
    </aside>
  );
}
