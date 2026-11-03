import { useEffect, useState } from 'react';
import { DashboardCard, DashboardCardBody, DashboardCardSkeleton } from '../../../../../../components/DashboardCard/DashboardCard';
import { PanelSectionItem } from '../../../../../../components/PanelSection/PanelSection';
import { Badge } from '../../../../../../components/Badge/Badge';
import { Button } from '../../../../../../components/Button/Button';
import { useAppStore } from '../../../../../../store/useAppStore';
import { programUrlKey } from '../../care-programs/CareProgramsTab/CareProgramsTab.utils';
import styles from './overviewCards.module.css';
import { isProgramClosed } from '../../../../data/programStatus';
import { programAttention } from './programAttention';
import { isEmptyDash } from '../../../../../../lib/emptyDash';

const VISIBLE = 3;
const REASON_CLASS = { error: styles.textError, warning: styles.textWarning };

export function CareProgramsCard({ patientId }) {
  const careProgramsByPatient = useAppStore(s => s.careProgramsByPatient);
  const loaded = useAppStore(s => s.careProgramsLoadedFor[patientId]);
  const fetchCareProgramsForPatient = useAppStore(s => s.fetchCareProgramsForPatient);
  const setPatientProfileTab = useAppStore(s => s.setPatientProfileTab);
  const openCareProgram = useAppStore(s => s.openCareProgram);
  const [openedAt] = useState(() => Date.now());

  useEffect(() => {
    if (patientId) fetchCareProgramsForPatient(patientId);
  }, [patientId, fetchCareProgramsForPatient]);

  if (!loaded) return <DashboardCardSkeleton icon="solar:stethoscope-linear" title="Active Care Programs" />;

  // Active = every enrollment that isn't closed; the full list lives on the
  // Care Programs tab.
  const programs = (careProgramsByPatient[patientId] || []).filter(p => !isProgramClosed(p.status));
  // Programs that need someone to act come first, each with why.
  const rows = programAttention(programs, openedAt);
  const goToCarePrograms = () => setPatientProfileTab('Care Programs');
  const openProgram = (prog) => {
    setPatientProfileTab('Care Programs');
    openCareProgram(programUrlKey(prog));
  };

  return (
    <DashboardCard
      icon="solar:stethoscope-linear"
      title="Active Care Programs"
      count={programs.length || null}
      actions={<Button variant="ghost" size="sm" onClick={goToCarePrograms}>View all</Button>}
    >
      <DashboardCardBody className={styles.listBody}>
        {programs.length === 0 ? (
          <p className={styles.empty}>Not enrolled in any care program.</p>
        ) : (
          <div className={styles.dividedRows}>
            {rows.slice(0, VISIBLE).map(({ program: prog, reason, tone }) => (
              <PanelSectionItem
                key={prog.id}
                inset
                title={<button type="button" className={styles.titleButton} onClick={() => openProgram(prog)}>{prog.name}</button>}
                meta={[
                  reason && <span key="why" className={REASON_CLASS[tone]}>{reason}</span>,
                  reason !== 'No owner' && (prog.assignee || 'Unassigned'),
                  !isEmptyDash(prog.startDate) && `Started ${prog.startDate}`,
                ]}
                trailing={(
                  <span className={styles.trail}>
                    <span className={styles.programTrailing}>
                      <span className={`${styles.bar} ${styles.barFixed}`} role="progressbar" aria-valuenow={prog.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`${prog.name} progress`}>
                        <span className={styles.barFill} style={{ width: `${prog.progress}%` }} />
                      </span>
                      <span className={`${styles.muted} ${styles.pct}`}>{prog.progress}%</span>
                    </span>
                    <span className={styles.statusSlotWide}><Badge tone="primary" size="sm" label={prog.status} /></span>
                  </span>
                )}
              />
            ))}
          </div>
        )}
      </DashboardCardBody>
    </DashboardCard>
  );
}
