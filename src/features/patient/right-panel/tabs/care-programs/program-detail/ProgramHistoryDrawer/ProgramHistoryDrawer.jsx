import { useEffect, useMemo } from 'react';
import { Drawer } from '../../../../../../../components/Drawer/Drawer';
import { CardSkeleton } from '../../../../../../../components/CardSkeleton/CardSkeleton';
import { EmptyState } from '../../../../../../../components/EmptyState/EmptyState';
import { useAppStore } from '../../../../../../../store/useAppStore';
import { ProgramActivityDay } from '../../../care-management/ProgramActivityCard/ProgramActivityCard.jsx';
import { groupProgramActivity } from '../../../care-management/programActivity';
import { useProgramHistory } from './useProgramHistory';
import styles from './ProgramHistoryDrawer.module.css';

/** History for one care program: its slice of the Program Activity Log. */
export function ProgramHistoryDrawer({ program, onClose }) {
  const fetchPatientProgramActivity = useAppStore(s => s.fetchPatientProgramActivity);
  const { patientId, entries, loading } = useProgramHistory(program);

  useEffect(() => {
    if (patientId) fetchPatientProgramActivity(patientId, { force: true });
  }, [patientId, fetchPatientProgramActivity]);

  const months = useMemo(() => groupProgramActivity(entries), [entries]);

  return (
    <Drawer title={`${program.name} History`} onClose={onClose} bodyClassName={styles.body}>
      {loading ? (
        <CardSkeleton count={4} />
      ) : months.length === 0 ? (
        <EmptyState icon="solar:history-linear" title="No activity for this program yet" />
      ) : (
        months.map(month => (
          <section key={month.key} className={styles.month}>
            <h3 className={styles.monthTitle}>{month.label}</h3>
            {month.days.map(day => <ProgramActivityDay key={day.key} day={day} />)}
          </section>
        ))
      )}
    </Drawer>
  );
}
