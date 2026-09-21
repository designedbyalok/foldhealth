import { useEffect, useMemo, useState } from 'react';
import { PriorityIcon } from '../../../../../components/PriorityIcon/PriorityIcon';
import { MenuPopover } from '../../../../../components/MenuPopover/MenuPopover';
import { useAppStore } from '../../../../../store/useAppStore';
import { buildCarePlanSnapshot } from '../care-programs/care-plan/summary/carePlanSnapshot';
import { GbiNameCell, GbiStatusButton } from '../care-programs/care-plan/tables/carePlanTableShared';
import { enrichGoalRows } from '../care-programs/care-plan/tables/carePlanTableSort';
import { normalizeCategory } from '../../../../settings/care-plan-library/lib';
import { GoalPreviewDrawer } from '../care-programs/care-plan/drawers/GoalPreviewDrawer/GoalPreviewDrawer';
import styles from './MonitoringRailGoals.module.css';

const CLOSED_GOAL_STATUSES = new Set(['Met', 'Not Met']);
const PRIORITIES = ['high', 'medium', 'low'];
const GBI_STATUSES = ['Not Started', 'In Progress', 'On Hold', 'Met', 'Not Met'];

export function MonitoringRailGoals({ patient }) {
  const patientId = patient?.id;
  const careProgramsByPatient = useAppStore((s) => s.careProgramsByPatient);
  const patientCarePlans = useAppStore((s) => s.patientCarePlans);
  const fetchCareProgramsForPatient = useAppStore((s) => s.fetchCareProgramsForPatient);
  const fetchAllPatientCarePlans = useAppStore((s) => s.fetchAllPatientCarePlans);
  const savePatientCarePlanGoal = useAppStore((s) => s.savePatientCarePlanGoal);
  const loading = useAppStore((s) => (patientId ? s.patientCarePlanAllLoading[patientId] : false));
  const loadedFor = useAppStore((s) => (patientId ? s.patientCarePlanAllLoadedFor[patientId] : false));

  const [previewGoal, setPreviewGoal] = useState(null);
  const [priorityMenu, setPriorityMenu] = useState(null);
  const [statusMenu, setStatusMenu] = useState(null);

  const programs = useMemo(
    () => (patientId ? (careProgramsByPatient[patientId] || []).filter((p) => p.status !== 'Closed') : []),
    [careProgramsByPatient, patientId],
  );

  useEffect(() => {
    if (!patientId) return;
    fetchCareProgramsForPatient?.(patientId);
    fetchAllPatientCarePlans?.(patientId);
  }, [patientId, fetchCareProgramsForPatient, fetchAllPatientCarePlans]);

  const activeGoals = useMemo(() => {
    if (!patientId) return [];
    const { goals } = buildCarePlanSnapshot(programs, patientCarePlans, patientId);
    const open = goals.filter((g) => !CLOSED_GOAL_STATUSES.has(g.status));
    return enrichGoalRows(open).sort((a, b) => {
      if (a._sortPriority !== b._sortPriority) return a._sortPriority - b._sortPriority;
      return (a.title || '').localeCompare(b.title || '');
    });
  }, [programs, patientCarePlans, patientId]);

  const changePriority = (priority) => {
    if (!priorityMenu || !patientId) return;
    const { item } = priorityMenu;
    setPriorityMenu(null);
    if (!item.program) return;
    savePatientCarePlanGoal(patientId, item.program, { ...item, priority }, item.id);
  };

  const changeStatus = (status) => {
    if (!statusMenu || !patientId) return;
    const { item } = statusMenu;
    setStatusMenu(null);
    if (!item.program) return;
    savePatientCarePlanGoal(patientId, item.program, { ...item, status }, item.id);
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.railGroupLabel}>Active Goals</div>
      {loading && !loadedFor ? (
        <div className={styles.empty}>Loading goals…</div>
      ) : activeGoals.length === 0 ? (
        <div className={styles.empty}>No active goals in the comprehensive care plan.</div>
      ) : (
        <div className={styles.table}>
          <div className={styles.colHead}>
            <span className={styles.pCell}>P</span>
            <span className={styles.titleCell}>Goal Title</span>
            <span className={styles.statusCell}>Status</span>
          </div>
          {activeGoals.map((g) => (
            <div
              key={`${g.programCode}-${g.id}`}
              className={styles.row}
              onClick={() => setPreviewGoal({ goal: g, program: g.program })}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setPreviewGoal({ goal: g, program: g.program });
                }
              }}
            >
              <div className={styles.pCell} onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className={styles.priorityBtn}
                  aria-label="Change priority"
                  onClick={(e) => setPriorityMenu({ item: g, rect: e.currentTarget.getBoundingClientRect() })}
                >
                  <PriorityIcon priority={g.priority} size={16} />
                </button>
              </div>
              <div className={styles.titleCell}>
                <GbiNameCell
                  icon={g.icon || 'solar:flag-linear'}
                  iconTitle={g.category ? normalizeCategory(g.category) : 'Goal'}
                  title={g.title}
                  layout="inline"
                />
              </div>
              <div className={styles.statusCell} onClick={(e) => e.stopPropagation()}>
                <GbiStatusButton
                  value={g.status}
                  badgeSize="S"
                  onOpen={(rect) => setStatusMenu({ item: g, rect })}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {priorityMenu && (
        <MenuPopover
          anchorRect={priorityMenu.rect}
          items={PRIORITIES.map((p) => ({ key: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))}
          onSelect={changePriority}
          onClose={() => setPriorityMenu(null)}
          width={140}
          align="left"
          ariaLabel="Change priority"
        />
      )}

      {statusMenu && (
        <MenuPopover
          anchorRect={statusMenu.rect}
          items={GBI_STATUSES.map((s) => ({ key: s, label: s }))}
          onSelect={changeStatus}
          onClose={() => setStatusMenu(null)}
          width={160}
          align="right"
          ariaLabel="Change status"
        />
      )}

      {previewGoal && patientId && (
        <GoalPreviewDrawer
          goal={previewGoal.goal}
          patientId={patientId}
          program={previewGoal.program}
          onClose={() => setPreviewGoal(null)}
        />
      )}
    </div>
  );
}
