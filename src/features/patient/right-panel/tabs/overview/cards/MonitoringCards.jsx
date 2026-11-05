// Overview cards backed by the patient's patient_monitoring snapshot (the
// same data as the Monitoring tab): since-last-touch recap, program steps.
import { useEffect } from 'react';
import { DashboardCard, DashboardCardBody, DashboardCardSkeleton } from '../../../../../../components/DashboardCard/DashboardCard';
import { PanelSectionItem } from '../../../../../../components/PanelSection/PanelSection';
import { CappedRows } from './CappedRows';
import { Badge } from '../../../../../../components/Badge/Badge';
import { Icon } from '../../../../../../components/Icon/Icon';
import { useAppStore } from '../../../../../../store/useAppStore';
import { programUrlKey } from '../../care-programs/CareProgramsTab/CareProgramsTab.utils';
import styles from './overviewCards.module.css';

function useMonitoring(memberId) {
  const data = useAppStore(s => (memberId ? s.patientMonitoring[memberId] : null));
  const fetchPatientMonitoring = useAppStore(s => s.fetchPatientMonitoring);
  useEffect(() => { if (memberId) fetchPatientMonitoring(memberId); }, [memberId, fetchPatientMonitoring]);
  return data;
}

export function SinceLastTouchCard({ memberId }) {
  const data = useMonitoring(memberId);
  if (memberId && data === undefined) return <DashboardCardSkeleton icon="custom:history" title="Since Last Visit" />;
  const items = data?.timeline || [];
  return (
    <DashboardCard
      icon="custom:history"
      title="Since Last Visit"
      count={items.length || null}
      footer={data?.continuityNext ? `Next touchpoint: ${data.continuityNext}` : null}
    >
      <DashboardCardBody className={styles.listBody}>
        {data?.continuityLast && <PanelSectionItem inset title="Last visit" meta={data.continuityLast} />}
        {items.length === 0 ? (
          <p className={styles.empty}>Nothing new recorded since the last visit.</p>
        ) : (
          <CappedRows
            items={items}
            render={t => (
              <PanelSectionItem
                key={t.text}
                inset
                title={t.text}
                wrapTitle
                trailing={t.source ? <span className={styles.statusSlotWide}><Badge size="sm" label={t.source} /></span> : null}
              />
            )}
          />
        )}
      </DashboardCardBody>
    </DashboardCard>
  );
}

const STEP = {
  done: { icon: 'solar:check-circle-linear', className: styles.textSuccess },
  current: { icon: 'solar:arrow-right-linear', className: styles.textWarning },
};

export function ProgramProgressCard({ memberId, patientId }) {
  const data = useMonitoring(memberId);
  const enrollments = useAppStore(s => s.careProgramsByPatient[patientId]);
  const fetchCareProgramsForPatient = useAppStore(s => s.fetchCareProgramsForPatient);
  const setPatientProfileTab = useAppStore(s => s.setPatientProfileTab);
  const openCareProgram = useAppStore(s => s.openCareProgram);
  useEffect(() => { if (patientId) fetchCareProgramsForPatient(patientId); }, [patientId, fetchCareProgramsForPatient]);

  const openProgram = (p) => {
    const match = (enrollments || []).find(pr => (p.code && pr.code === p.code) || (p.name && pr.name === p.name));
    setPatientProfileTab('Care Programs');
    if (match) openCareProgram(programUrlKey(match));
  };

  if (memberId && data === undefined) return <DashboardCardSkeleton icon="solar:checklist-linear" title="Program Progress" />;
  const programs = (data?.programs || []).filter(p => p.steps?.length || p.progress);
  return (
    <DashboardCard icon="solar:checklist-linear" title="Program Progress" count={programs.length || null}>
      <DashboardCardBody className={styles.listBody}>
        {programs.length === 0 ? (
          <p className={styles.empty}>No program steps tracked for this patient yet.</p>
        ) : programs.slice(0, 2).map(p => (
          <div key={p.code} className={styles.programBlock}>
            <div className={styles.clickRow}>
              <PanelSectionItem
                inset
                leading={<span className={styles.codeChip}>{p.code}</span>}
                title={(
                  <button type="button" className={`${styles.titleButton} ${styles.stretch}`} onClick={() => openProgram(p)}>
                    {p.name}
                  </button>
                )}
                meta={[p.progress, p.next]}
                wrapTitle
              />
            </div>
            {(p.steps || []).slice(0, 3).map(s => {
              const st = STEP[s.status];
              return (
                <div key={s.label} className={styles.clickRow}>
                  <PanelSectionItem
                    inset
                    leading={<span className={st?.className || styles.muted}><Icon name={st?.icon || 'solar:record-linear'} size={14} /></span>}
                    title={(
                      <button type="button" className={`${styles.titleButton} ${styles.stretch}`} onClick={() => openProgram(p)}>
                        {s.label}
                      </button>
                    )}
                    meta={s.meta || s.sub}
                    wrapTitle
                  />
                </div>
              );
            })}
          </div>
        ))}
        {programs.length > 2 && (
          <p className={`${styles.muted} ${styles.listNote}`}>{programs.length - 2} more program{programs.length - 2 === 1 ? '' : 's'} on the Care Management tab.</p>
        )}
      </DashboardCardBody>
    </DashboardCard>
  );
}
