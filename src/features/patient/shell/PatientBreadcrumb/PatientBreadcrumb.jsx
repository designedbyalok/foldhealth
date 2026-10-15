import { useAppStore } from '../../../../store/useAppStore';
import styles from './PatientBreadcrumb.module.css';

/**
 * "Population / <list> / <patient>" as a card header. Stands in for the
 * TopBar when the patient view splits into a patient card and a program
 * card, so the trail to the worklist stays one click away.
 */
export function PatientBreadcrumb({ patientName }) {
  const activeSubnavList = useAppStore(s => s.activeSubnavList);
  const navigateBackToWorklist = useAppStore(s => s.navigateBackToWorklist);
  const showList = activeSubnavList && !activeSubnavList.startsWith('pg:');

  return (
    <header className={styles.header}>
      <nav className={styles.trail} aria-label="Breadcrumb">
        <button type="button" className={styles.link} onClick={() => navigateBackToWorklist()}>Population</button>
        {showList && (
          <>
            <span className={styles.sep} aria-hidden="true">/</span>
            <button type="button" className={styles.link} onClick={() => navigateBackToWorklist()}>{activeSubnavList}</button>
          </>
        )}
        <span className={styles.sep} aria-hidden="true">/</span>
        <span className={styles.current} aria-current="page">{patientName}</span>
      </nav>
    </header>
  );
}
