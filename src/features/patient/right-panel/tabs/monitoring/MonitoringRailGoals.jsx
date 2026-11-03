import { useEffect, useMemo, useState } from 'react';
import { PriorityIcon } from '../../../../../components/PriorityIcon/PriorityIcon';
import { MenuPopover } from '../../../../../components/MenuPopover/MenuPopover';
import { useAppStore } from '../../../../../store/useAppStore';
import { buildCarePlanSnapshot } from '../care-programs/care-plan/summary/carePlanSnapshot';
import { carePlanSources } from '../care-programs/care-plan/lib/carePlanMode';
import { GbiNameCell, GbiStatusButton, gbiStatusMenuItems } from '../care-programs/care-plan/tables/carePlanTableShared';
import { isClosedStatus } from '../care-programs/care-plan/lib/gbiStatus';
import { enrichGoalRows } from '../care-programs/care-plan/tables/carePlanTableSort';
import { normalizeCategory } from '../../../../settings/care-plan-library/lib';
import { GoalPreviewDrawer } from '../care-programs/care-plan/drawers/GoalPreviewDrawer/GoalPreviewDrawer';
import { useSignedCarePlans } from '../care-programs/care-plan/lib/useSignedCarePlans';
import styles from './MonitoringRailGoals.module.css';
import { isProgramClosed } from '../../../data/programStatus';
import { confirmStatusChange, statusReasonPatch } from '../care-programs/care-plan/lib/confirmStatusChange';

const PRIORITIES = ['high', 'medium', 'low'];

// Goals on signed care plans. Status and priority are progress on the signed
// plan, so they change from here directly.
export function MonitoringRailGoals({ patient }) {
  const patientId = patient?.id;
  const careProgramsByPatient = useAppStore((s) => s.careProgramsByPatient);
  const signedCarePlans = useSignedCarePlans();
  const saveCarePlanLiveField = useAppStore((s) => s.saveCarePlanLiveField);
  const fetchCareProgramsForPatient = useAppStore((s) => s.fetchCareProgramsForPatient);
  const fetchSignedCarePlans = useAppStore((s) => s.fetchSignedCarePlans);
  const loading = useAppStore((s) => (patientId ? s.patientSignedCarePlansLoading[patientId] : false));
  const loadedFor = useAppStore((s) => (patientId ? s.patientSignedCarePlansLoadedFor[patientId] : false));

  const [previewGoal, setPreviewGoal] = useState(null);
  const [priorityMenu, setPriorityMenu] = useState(null);
  const [statusMenu, setStatusMenu] = useState(null);

  const carePlanMode = useAppStore((s) => s.carePlanMode);
  // Goals come from whichever level this org plans at: the patient's own plan,
  // or its open programs' plans.
  const programs = useMemo(
    () => carePlanSources(
      carePlanMode,
      patientId ? (careProgramsByPatient[patientId] || []).filter((p) => !isProgramClosed(p.status)) : [],
      patientId,
    ),
    [careProgramsByPatient, patientId, carePlanMode],
  );

  useEffect(() => {
    if (!patientId) return;
    fetchCareProgramsForPatient?.(patientId);
    fetchSignedCarePlans?.(patientId);
  }, [patientId, fetchCareProgramsForPatient, fetchSignedCarePlans]);

  const activeGoals = useMemo(() => {
    if (!patientId) return [];
    const { goals } = buildCarePlanSnapshot(programs, signedCarePlans, patientId);
    const open = goals.filter((g) => !isClosedStatus(g.status));
    return enrichGoalRows(open).sort((a, b) => {
      if (a._sortPriority !== b._sortPriority) return a._sortPriority - b._sortPriority;
      return (a.title || '').localeCompare(b.title || '');
    });
  }, [programs, signedCarePlans, patientId]);

  const changePriority = (priority) => {
    if (!priorityMenu || !patientId) return;
    const { item } = priorityMenu;
    setPriorityMenu(null);
    if (item.program) saveCarePlanLiveField(patientId, item.program, 'goal', item.id, { priority });
  };

  const changeStatus = async (status) => {
    if (!statusMenu || !patientId) return;
    const { item } = statusMenu;
    setStatusMenu(null);
    if (!item.program) return;
    const why = await confirmStatusChange([{ type: 'goal', item }], status);
    if (!why) return;
    saveCarePlanLiveField(patientId, item.program, 'goal', item.id, { status, ...statusReasonPatch(item, why) });
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.railGroupLabel}>Active Goals</div>
      {loading && !loadedFor ? (
        <div className={styles.empty}>Loading goals…</div>
      ) : activeGoals.length === 0 ? (
        <div className={styles.empty}>No active goals on a signed care plan.</div>
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
              <button
                type="button"
                className={styles.titleCell}
                onClick={() => setPreviewGoal({ goal: g, program: g.program })}
              >
                <GbiNameCell
                  icon={g.icon || 'solar:flag-linear'}
                  iconTitle={g.category ? normalizeCategory(g.category) : 'Goal'}
                  title={g.title}
                  layout="inline"
                />
              </button>
              <div className={styles.statusCell} onClick={(e) => e.stopPropagation()}>
                <GbiStatusButton
                  value={g.status} reason={g.statusReason}
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
          items={gbiStatusMenuItems('goal', statusMenu.item?.status)}
          onSelect={changeStatus}
          onClose={() => setStatusMenu(null)}
          width={180}
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
          signedView
        />
      )}
    </div>
  );
}
