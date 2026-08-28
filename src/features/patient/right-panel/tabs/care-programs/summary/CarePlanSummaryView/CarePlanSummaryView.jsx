import { useEffect, useMemo } from 'react';
import { Icon } from '../../../../../../../components/Icon/Icon';
import { Badge } from '../../../../../../../components/Badge/Badge';
import { Avatar } from '../../../../../../../components/Avatar/Avatar';
import { CloseButton } from '../../../../../../../components/CloseButton/CloseButton';
import { PriorityIcon } from '../../../../../../../components/PriorityIcon/PriorityIcon';
import { RingEmptyState } from '../../../../../../../components/RingEmptyState/RingEmptyState';
import { TableSkeleton } from '../../../../../../../components/TableSkeleton/TableSkeleton';
import { useAppStore } from '../../../../../../../store/useAppStore';
import styles from './CarePlanSummaryView.module.css';

const norm = (s) => (s || '').trim().toLowerCase();

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
export function CarePlanSummaryView({ patientId, programs, onClose, onOpenProgramStep }) {
  const fetchAllPatientCarePlans = useAppStore(s => s.fetchAllPatientCarePlans);
  const loading = useAppStore(s => s.patientCarePlanAllLoading[patientId]);
  const loadedFor = useAppStore(s => s.patientCarePlanAllLoadedFor[patientId]);
  const patientCarePlans = useAppStore(s => s.patientCarePlans);

  useEffect(() => {
    if (patientId) fetchAllPatientCarePlans(patientId);
  }, [patientId, fetchAllPatientCarePlans]);

  // Flatten every program's plan into two lists tagged with their program, and
  // union the conditions. Duplicate detection is by normalized title across
  // programs — the same goal on two programs is surfaced, not hidden.
  const { conditions, goals, interventions } = useMemo(() => {
    const conditionSet = new Map();
    const goalRows = [];
    const intvRows = [];
    const goalTitleCounts = new Map();

    for (const program of programs) {
      const plan = patientCarePlans[`${patientId}::${program.id}`];
      if (!plan) continue;
      for (const c of (plan.plan?.conditions || [])) if (!conditionSet.has(norm(c.label))) conditionSet.set(norm(c.label), c.label);
      for (const g of plan.goals) {
        goalTitleCounts.set(norm(g.title), (goalTitleCounts.get(norm(g.title)) || 0) + 1);
        goalRows.push({ ...g, program, programCode: program.code });
      }
      for (const i of plan.interventions) intvRows.push({ ...i, program, programCode: program.code });
    }
    for (const g of goalRows) g.duplicate = goalTitleCounts.get(norm(g.title)) > 1;

    return {
      conditions: [...conditionSet.values()],
      goals: goalRows,
      interventions: intvRows,
    };
  }, [programs, patientCarePlans, patientId]);

  const isEmpty = loadedFor && goals.length === 0 && interventions.length === 0;

  return (
    <div className={styles.container}>
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
            <span className={styles.sectionTitle}>Goals <span className={styles.count}>{goals.length}</span></span>
            <div className={styles.table}>
              <div className={styles.goalHead}>
                <span className={styles.pCell}>P</span>
                <span className={styles.titleCell}>Goal Title</span>
                <span className={styles.programCell}>Program</span>
                <span className={styles.statusCell}>Status</span>
                <span className={styles.chevronCell} />
              </div>
              {goals.length === 0
                ? <div className={styles.emptyRow}>No goals across programs.</div>
                : goals.map(g => <GoalRow key={`${g.programCode}-${g.id}`} row={g} onOpen={() => onOpenProgramStep(g.program)} />)}
            </div>
          </div>

          <div className={styles.section}>
            <span className={styles.sectionTitle}>Interventions <span className={styles.count}>{interventions.length}</span></span>
            <div className={styles.table}>
              <div className={styles.intvHead}>
                <span className={styles.pCell}>P</span>
                <span className={styles.titleCell}>Name</span>
                <span className={styles.assigneeCell}>Assigned To</span>
                <span className={styles.programCell}>Program</span>
                <span className={styles.statusCell}>Status</span>
                <span className={styles.chevronCell} />
              </div>
              {interventions.length === 0
                ? <div className={styles.emptyRow}>No interventions across programs.</div>
                : interventions.map(i => <InterventionRow key={`${i.programCode}-${i.id}`} row={i} onOpen={() => onOpenProgramStep(i.program)} />)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
