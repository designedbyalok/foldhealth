import { useEffect, useMemo } from 'react';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { Badge } from '../../../../../../../../components/Badge/Badge';
import { Avatar } from '../../../../../../../../components/Avatar/Avatar';
import { CloseButton } from '../../../../../../../../components/CloseButton/CloseButton';
import { PriorityIcon } from '../../../../../../../../components/PriorityIcon/PriorityIcon';
import { RingEmptyState } from '../../../../../../../../components/RingEmptyState/RingEmptyState';
import { TableSkeleton } from '../../../../../../../../components/TableSkeleton/TableSkeleton';
import { useAppStore } from '../../../../../../../../store/useAppStore';
import { buildCarePlanSnapshot, filterCarePlanSnapshot } from '../carePlanSnapshot';
import styles from './CarePlanSummaryView.module.css';

// One row's worth of goal, annotated with the program it came from and whether
// the same goal title shows up on more than one program (a duplicate GBI).
function GoalRow({ row, onOpen }) {
  return (
    <button type="button" className={styles.row} onClick={onOpen}>
      <span className={styles.pCell}><PriorityIcon priority={row.priority} size={16} /></span>
      <span className={styles.titleCell}>
        <span className={styles.rowIcon}><Icon name={row.icon} size={16} color="var(--neutral-400)" /></span>
        <span className={styles.titleText}>
          <span className={styles.titleLine}>
            <span className={styles.title}>{row.title}</span>
            {row.duplicate && (
              <span className={styles.dupFlag} title="This goal appears on more than one program">
                <Icon name="solar:copy-linear" size={12} color="var(--status-warning)" />
                Duplicate
              </span>
            )}
          </span>
          {row.subtitle && <span className={styles.subtitle}>{row.subtitle}</span>}
        </span>
      </span>
      <span className={styles.programCell}><Badge tone="grey" size="S" label={row.programCode} /></span>
      <span className={styles.statusCell}>{row.status}</span>
      <span className={styles.chevronCell}><Icon name="solar:alt-arrow-right-linear" size={16} color="var(--neutral-300)" /></span>
    </button>
  );
}

function InterventionRow({ row, onOpen }) {
  return (
    <button type="button" className={`${styles.row} ${styles.rowIntv}`} onClick={onOpen}>
      <span className={styles.pCell}><PriorityIcon priority={row.priority} size={16} /></span>
      <span className={styles.titleCell}>
        <span className={styles.rowIcon}><Icon name={row.icon} size={16} color="var(--neutral-400)" /></span>
        <span className={styles.title}>{row.title}</span>
      </span>
      <span className={styles.assigneeCell}>
        <Avatar variant="staff" size={24} initials={row.assignee?.initials} />
        <span className={styles.assigneeName}>{row.assignee?.name}</span>
      </span>
      <span className={styles.programCell}><Badge tone="grey" size="S" label={row.programCode} /></span>
      <span className={styles.statusCell}>{row.status}</span>
      <span className={styles.chevronCell}><Icon name="solar:alt-arrow-right-linear" size={16} color="var(--neutral-300)" /></span>
    </button>
  );
}

// Read-only, patient-level snapshot of every care plan across all of a
// patient's programs (roadmap #1 / E2). Clicking a row hands off to the owning
// program's Care Plan step for edits.
export function CarePlanSummaryView({ patientId, programs, onClose, onOpenProgramStep, searchText = '', programFilter = [], embedded = false }) {
  const fetchAllPatientCarePlans = useAppStore(s => s.fetchAllPatientCarePlans);
  const loading = useAppStore(s => s.patientCarePlanAllLoading[patientId]);
  const loadedFor = useAppStore(s => s.patientCarePlanAllLoadedFor[patientId]);
  const patientCarePlans = useAppStore(s => s.patientCarePlans);

  useEffect(() => {
    if (patientId) fetchAllPatientCarePlans(patientId);
  }, [patientId, fetchAllPatientCarePlans]);

  // Flatten every program's plan into goals + interventions tagged with their
  // program (shared with the Download export).
  const { conditions, goals, interventions } = useMemo(
    () => buildCarePlanSnapshot(programs, patientCarePlans, patientId),
    [programs, patientCarePlans, patientId],
  );

  // Apply the toolbar's search + program filter to the flattened snapshot.
  const progKey = programFilter.join('|');
  const { goals: filteredGoals, interventions: filteredInterventions } = useMemo(
    () => filterCarePlanSnapshot({ conditions, goals, interventions }, { searchText, programFilter }),
    [conditions, goals, interventions, searchText, progKey], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const isEmpty = loadedFor && goals.length === 0 && interventions.length === 0;

  return (
    <div className={`${styles.container} ${embedded ? styles.embedded : ''}`}>
      {!embedded && (
        <div className={styles.header}>
          <div className={styles.headerText}>
            <span className={styles.headerTitle}>Care Plan</span>
            <span className={styles.headerMeta}>All programs · read-only snapshot</span>
          </div>
          <span className={styles.readOnlyBadge}>
            <Icon name="solar:lock-keyhole-minimalistic-linear" size={14} color="var(--neutral-300)" />
            Read only
          </span>
          <span className={styles.headerDivider} />
          <CloseButton onClick={onClose} />
        </div>
      )}

      {loading && !loadedFor ? (
        <TableSkeleton rows={6} />
      ) : isEmpty ? (
        <RingEmptyState icon="solar:hand-heart-linear" label="No Care Plans Yet" />
      ) : (
        <div className={styles.body}>
          {conditions.length > 0 && (
            <div className={styles.chips}>
              {conditions.map(c => <Badge key={c} tone="grey" size="S" label={c} />)}
            </div>
          )}

          <div className={styles.section}>
            <span className={styles.sectionTitle}>Goals <span className={styles.count}>{filteredGoals.length}</span></span>
            <div className={styles.table}>
              <div className={styles.goalHead}>
                <span className={styles.pCell}>P</span>
                <span className={styles.titleCell}>Goal Title</span>
                <span className={styles.programCell}>Program</span>
                <span className={styles.statusCell}>Status</span>
                <span className={styles.chevronCell} />
              </div>
              {filteredGoals.length === 0
                ? <div className={styles.emptyRow}>No goals match.</div>
                : filteredGoals.map(g => <GoalRow key={`${g.programCode}-${g.id}`} row={g} onOpen={() => onOpenProgramStep(g.program)} />)}
            </div>
          </div>

          <div className={styles.section}>
            <span className={styles.sectionTitle}>Interventions <span className={styles.count}>{filteredInterventions.length}</span></span>
            <div className={styles.table}>
              <div className={styles.intvHead}>
                <span className={styles.pCell}>P</span>
                <span className={styles.titleCell}>Name</span>
                <span className={styles.assigneeCell}>Assigned To</span>
                <span className={styles.programCell}>Program</span>
                <span className={styles.statusCell}>Status</span>
                <span className={styles.chevronCell} />
              </div>
              {filteredInterventions.length === 0
                ? <div className={styles.emptyRow}>No interventions match.</div>
                : filteredInterventions.map(i => <InterventionRow key={`${i.programCode}-${i.id}`} row={i} onOpen={() => onOpenProgramStep(i.program)} />)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
