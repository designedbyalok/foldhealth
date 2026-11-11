import { useMemo, useState } from 'react';
import { DashboardCard, DashboardCardBody } from '@/components/DashboardCard/DashboardCard';
import { PanelSectionItem } from '@/components/PanelSection/PanelSection';
import { Icon } from '@/components/Icon/Icon';
import { Badge } from '@/components/Badge/Badge';
import { AddTaskDrawer } from '../../../../../../../tasks/AddTaskDrawer';
import { TasksCard } from '../../../../overview/cards/TasksCard';
import { CappedRows } from '../../../../overview/cards/CappedRows';
import styles from '../../CarePlanView/CarePlanFocusPanel.module.css';

const SEVERITY_ICON = {
  danger: ['solar:danger-circle-linear', 'var(--status-error)'],
  warning: ['solar:danger-triangle-linear', 'var(--status-warning)'],
};

/**
 * The All Programs care plan's side panel while no item is open: Look at
 * These First across every plan (each row tagged with its program) and the
 * patient's tasks. A program's own review cadence and suggested actions stay
 * in that program's view.
 */
export function AllProgramsFocus({ patientId, patientName, attention, onOpenItem }) {
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const patient = useMemo(() => ({ id: patientId, memberId: patientId, name: patientName }), [patientId, patientName]);
  return (
    <div className={styles.panel}>
      <DashboardCard icon="solar:danger-circle-linear" title="Look at These First" count={attention.length || null}>
        <DashboardCardBody className={styles.listBody}>
          {attention.length === 0 ? (
            <p className={styles.empty}>Nothing needs attention across the programs.</p>
          ) : (
            <CappedRows
              items={attention}
              limit={5}
              render={f => {
                const [icon, color] = SEVERITY_ICON[f.severity];
                return (
                  <PanelSectionItem
                    key={f.key}
                    inset
                    alignTop
                    wrapTitle
                    leading={<Icon name={icon} size={16} color={color} />}
                    title={<button type="button" className={styles.titleButton} onClick={() => onOpenItem(f.kind, f.item, f.program)}>{f.title}</button>}
                    meta={f.text}
                    trailing={<Badge size="sm" label={f.program.code} />}
                  />
                );
              }}
            />
          )}
        </DashboardCardBody>
      </DashboardCard>
      <TasksCard patient={patient} actions={{ addTask: () => setAddTaskOpen(true) }} />
      {addTaskOpen && (
        <AddTaskDrawer initialMember={patientName} onClose={() => setAddTaskOpen(false)} onTaskCreated={() => setAddTaskOpen(false)} />
      )}
    </div>
  );
}
