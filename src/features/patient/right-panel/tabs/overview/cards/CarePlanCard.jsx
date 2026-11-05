import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { DashboardCard, DashboardCardBody, DashboardCardSkeleton } from '../../../../../../components/DashboardCard/DashboardCard';
import { PanelSectionItem } from '../../../../../../components/PanelSection/PanelSection';
import { PriorityIcon } from '../../../../../../components/PriorityIcon/PriorityIcon';
import { Button } from '../../../../../../components/Button/Button';
import { Icon } from '../../../../../../components/Icon/Icon';
import { CountToggle } from './CountToggle';
import { MenuPopover } from '../../../../../../components/MenuPopover/MenuPopover';
import { useAppStore } from '../../../../../../store/useAppStore';
import { GbiStatusButton, gbiStatusMenuItems } from '../../care-programs/care-plan/tables/carePlanTableShared';
import { carePlanByKind } from '../attention/carePlanAttention';
import { CappedRows } from './CappedRows';
import styles from './overviewCards.module.css';

const GoalPreviewDrawer = lazy(() => import('../../care-programs/care-plan/drawers/GoalPreviewDrawer/GoalPreviewDrawer').then(m => ({ default: m.GoalPreviewDrawer })));
const InterventionPreviewDrawer = lazy(() => import('../../care-programs/care-plan/drawers/InterventionPreviewDrawer/InterventionPreviewDrawer').then(m => ({ default: m.InterventionPreviewDrawer })));
const BarrierDetailDrawer = lazy(() => import('../../care-programs/care-plan/drawers/BarrierDetailDrawer/BarrierDetailDrawer').then(m => ({ default: m.BarrierDetailDrawer })));

const KINDS = [['goal', 'Goals'], ['intervention', 'Interventions'], ['barrier', 'Barriers']];
const REASON_CLASS = { error: styles.textError, warning: styles.textWarning };

export function CarePlanCard({ patientId, actions }) {
  const plans = useAppStore(s => s.patientCarePlans);
  const loading = useAppStore(s => s.patientCarePlanAllLoading[patientId]);
  const loaded = useAppStore(s => s.patientCarePlanAllLoadedFor[patientId]);
  const fetchAll = useAppStore(s => s.fetchAllPatientCarePlans);
  const saveCarePlanLiveField = useAppStore(s => s.saveCarePlanLiveField);
  const [statusMenu, setStatusMenu] = useState(null);
  const [goal, setGoal] = useState(null);
  const [intervention, setIntervention] = useState(null);
  const [barrier, setBarrier] = useState(null);
  const [kind, setKind] = useState(null);

  // The clock the attention rules read (past due, new this month), taken once per mount.
  const [openedAt] = useState(() => Date.now());

  useEffect(() => { if (patientId) fetchAll(patientId); }, [patientId, fetchAll]);

  // Every program's plan for this patient, merged. Each row keeps the program
  // it belongs to so the preview drawer and status save hit the right plan.
  const { goals, interventions, barriers } = useMemo(() => {
    const prefix = `${patientId}::`;
    const merged = { goals: [], interventions: [], barriers: [] };
    for (const [key, plan] of Object.entries(plans)) {
      if (!key.startsWith(prefix) || !plan) continue;
      const program = { id: plan.plan?.programId || key.slice(prefix.length) };
      const tag = (items) => (items || []).map(item => ({
        ...item,
        program: item.program?.id ? item.program : program,
      }));
      merged.goals.push(...tag(plan.goals));
      merged.interventions.push(...tag(plan.interventions));
      merged.barriers.push(...tag(plan.barriers));
    }
    return merged;
  }, [plans, patientId]);
  const byKind = useMemo(
    () => carePlanByKind({ goals, interventions, barriers, now: openedAt }),
    [goals, interventions, barriers, openedAt],
  );

  if (!loaded && loading !== false) return <DashboardCardSkeleton icon="solar:clipboard-list-linear" title="Care Plan" />;

  const empty = goals.length + interventions.length + barriers.length === 0;
  // Until the reader picks, open on the first kind with something to act on.
  const active = kind ?? (KINDS.find(([k]) => byKind[k].some(e => e.reason)) || KINDS[0])[0];
  const list = byKind[active];

  const openItem = (kind, item) => {
    const next = { item, program: item.program };
    if (kind === 'goal') setGoal(next);
    else if (kind === 'intervention') setIntervention(next);
    else setBarrier(next);
  };

  const changeStatus = (status) => {
    const menu = statusMenu;
    setStatusMenu(null);
    if (!menu?.item?.program?.id || !menu.item.id) return;
    saveCarePlanLiveField(patientId, menu.item.program, menu.type, menu.item.id, { status });
  };

  return (
    <DashboardCard
      icon="solar:clipboard-list-linear"
      title="Care Plan"
      tabs={!empty && (
        <CountToggle
          items={KINDS.map(([key, label]) => ({ key, label, count: byKind[key].length }))}
          active={active}
          onChange={setKind}
        />
      )}
      actions={<Button variant="outline" size="sm" trailingIcon="solar:arrow-right-linear" onClick={actions.openCarePlan}>Open Care Plan</Button>}
    >
      <DashboardCardBody className={styles.listBody}>
        {empty ? (
          <p className={styles.empty}>No care plan yet. Open the care plan to add goals, interventions and barriers.</p>
        ) : list.length === 0 ? (
          <p className={styles.empty}>No open {KINDS.find(([k]) => k === active)[1].toLowerCase()}.</p>
        ) : (
          <div className={styles.dividedRows}>
            <CappedRows
              items={list}
              resetKey={active}
              render={({ kind: k, item, tone, detail }) => (
                <div key={`${k}-${item.program?.id || ''}-${item.id || item.title}`} className={styles.clickRow}>
                  <PanelSectionItem
                    inset
                    leading={<PriorityIcon priority={item.priority} title={item.priority ? `${item.priority} priority` : 'No priority'} />}
                    title={(
                      <button type="button" className={`${styles.titleButton} ${styles.stretch}`} onClick={() => openItem(k, item)}>
                        {item.title}
                      </button>
                    )}
                    meta={detail && (
                      <span className={`${styles.why} ${REASON_CLASS[tone] || ''}`}>
                        <Icon name="solar:star-shine-linear" size={12} />
                        {detail}
                      </span>
                    )}
                    trailing={(
                      <span className={`${styles.statusSlotWide} ${styles.aboveStretch}`}>
                        <GbiStatusButton
                          value={item.status || 'Not Started'} reason={item.statusReason}
                          disabled={!item.id || !item.program?.id}
                          onOpen={(rect) => setStatusMenu({ type: k, item, rect })}
                        />
                      </span>
                    )}
                  />
                </div>
              )}
            />
          </div>
        )}
      </DashboardCardBody>
      {statusMenu && (
        <MenuPopover
          anchorRect={statusMenu.rect}
          align="left"
          width={200}
          ariaLabel="Change status"
          items={gbiStatusMenuItems(statusMenu.type, statusMenu.item?.status)}
          onSelect={changeStatus}
          onClose={() => setStatusMenu(null)}
        />
      )}
      {goal && (
        <Suspense fallback={null}>
          <GoalPreviewDrawer
            goal={goal.item}
            patientId={patientId}
            program={goal.program}
            onClose={() => setGoal(null)}
            onOpenIntervention={(item) => setIntervention({ item: { ...item, program: item.program || goal.program }, program: item.program || goal.program })}
            onOpenBarrier={(item) => setBarrier({ item: { ...item, program: item.program || goal.program }, program: item.program || goal.program })}
          />
        </Suspense>
      )}
      {intervention && (
        <Suspense fallback={null}>
          <InterventionPreviewDrawer
            intervention={intervention.item}
            patientId={patientId}
            program={intervention.program}
            onClose={() => setIntervention(null)}
            onOpenGoal={(item) => setGoal({ item: { ...item, program: item.program || intervention.program }, program: item.program || intervention.program })}
          />
        </Suspense>
      )}
      {barrier && (
        <Suspense fallback={null}>
          <BarrierDetailDrawer
            barrier={barrier.item}
            patientId={patientId}
            program={barrier.program}
            onClose={() => setBarrier(null)}
            onOpenGoal={(item) => setGoal({ item: { ...item, program: item.program || barrier.program }, program: item.program || barrier.program })}
          />
        </Suspense>
      )}
    </DashboardCard>
  );
}
