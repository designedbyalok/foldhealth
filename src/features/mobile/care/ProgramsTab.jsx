import { useEffect, useMemo } from 'react';
import { Badge } from '../../../components/Badge/Badge';
import { Icon } from '../../../components/Icon/Icon';
import { Skeleton } from '../../../components/Skeleton/Skeleton';
import { useAppStore } from '../../../store/useAppStore';
import { isProgramClosed } from '../../patient/data/programStatus';
import { patientLevelProgram, showsPatientCarePlan } from '../../patient/right-panel/tabs/care-programs/care-plan/lib/carePlanMode';
import { isEmptyDash } from '../../../lib/emptyDash';
import { useMobileNav } from '../MobileNavContext';
import { programTone } from './careUtils';
import styles from './care.module.css';

const EMPTY = [];
const isEmptyDate = (v) => !v || v === '-' || isEmptyDash(v);

/**
 * A patient's care programs (Figma P360 "Care Journeys"), Active then Past,
 * plus the patient-level care plan when the org plans per patient. Content
 * only: the profile's Programs tab supplies the scrolling grey body.
 */
export function ProgramsTab({ patientId }) {
  const { push } = useMobileNav();
  const programs = useAppStore(s => (patientId ? s.careProgramsByPatient[patientId] : null)) || EMPTY;
  const loaded = useAppStore(s => !!(patientId && s.careProgramsLoadedFor[patientId]));
  const fetchCareProgramsForPatient = useAppStore(s => s.fetchCareProgramsForPatient);
  const carePlanMode = useAppStore(s => s.carePlanMode);
  useEffect(() => { if (patientId) fetchCareProgramsForPatient?.(patientId); }, [patientId, fetchCareProgramsForPatient]);

  const active = useMemo(() => programs.filter(p => !isProgramClosed(p.status)), [programs]);
  const past = useMemo(() => programs.filter(p => isProgramClosed(p.status)), [programs]);

  if (!loaded && programs.length === 0) {
    return (
      <div className={`${styles.group} ${styles.tab}`} aria-busy="true">
        <Skeleton width="100%" height={112} radius={12} />
        <Skeleton width="100%" height={112} radius={12} />
      </div>
    );
  }

  const open = (p) => push('program', { patientId, programId: p.id });

  return (
    <div className={`${styles.stack} ${styles.tab}`}>
      {showsPatientCarePlan(carePlanMode) && patientId && (
        <button
          type="button"
          className={styles.card}
          onClick={() => push('carePlan', { patientId, programId: patientLevelProgram(patientId).id })}
        >
          <div className={styles.cardHead}>
            <Icon name="solar:clipboard-heart-linear" size={24} color="var(--primary-300)" />
            <p className={styles.cardTitle}>Care Plan</p>
            <Icon name="solar:alt-arrow-right-linear" size={20} color="var(--neutral-300)" />
          </div>
          <p className={styles.meta}>Goals, interventions and barriers for this patient</p>
        </button>
      )}

      <section className={styles.group}>
        <h2 className={styles.groupTitle}>Active Programs <span className={styles.groupCount}>{active.length}</span></h2>
        {active.length === 0
          ? <p className={styles.empty}>No active programs</p>
          : active.map(p => <ProgramCard key={p.id} program={p} onOpen={() => open(p)} />)}
      </section>

      {past.length > 0 && (
        <section className={styles.group}>
          <h2 className={styles.groupTitle}>Past Programs <span className={styles.groupCount}>{past.length}</span></h2>
          {past.map(p => <ProgramCard key={p.id} program={p} onOpen={() => open(p)} />)}
        </section>
      )}
    </div>
  );
}

function ProgramCard({ program: p, onOpen }) {
  const progress = Math.max(0, Math.min(100, Number(p.progress) || 0));
  const dates = [
    !isEmptyDate(p.startDate) ? `Started ${p.startDate}` : null,
    !isEmptyDate(p.endDate) ? `Ended ${p.endDate}` : null,
  ].filter(Boolean).join(' • ');
  return (
    <button type="button" className={styles.card} onClick={onOpen}>
      <div className={styles.cardHead}>
        <span className={styles.code}>{p.code}</span>
        <p className={styles.cardTitle}>{p.subProgram ? `${p.name} · ${p.subProgram}` : p.name}</p>
        <Badge size="sm" tone={programTone(p.status)} variant="soft" label={p.status || 'New'} />
      </div>
      <div className={styles.progressRow}>
        <span className={styles.bar} aria-hidden="true"><span className={styles.barFill} style={{ width: `${progress}%` }} /></span>
        <span>{progress}%</span>
      </div>
      <p className={styles.meta}>
        {[p.assignee && p.assignee !== 'Unassigned' ? `Assigned to ${p.assignee}` : 'Unassigned', dates].filter(Boolean).join(' • ')}
      </p>
    </button>
  );
}
