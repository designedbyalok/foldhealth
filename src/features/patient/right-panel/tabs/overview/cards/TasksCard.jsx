import { useEffect, useMemo, useState } from 'react';
import { DashboardCard, DashboardCardBody } from '../../../../../../components/DashboardCard/DashboardCard';
import { PanelSectionItem } from '../../../../../../components/PanelSection/PanelSection';
import { CappedRows } from './CappedRows';
import { CountToggle } from './CountToggle';
import { PriorityIcon } from '../../../../../../components/PriorityIcon/PriorityIcon';
import { Checkbox } from '../../../../../../components/Checkbox/Checkbox';
import { Button } from '../../../../../../components/Button/Button';
import { FilterChip } from '../../../../../../components/FilterChip/FilterChip';
import { useAppStore } from '../../../../../../store/useAppStore';
import { groupTasksForTab } from '../../../../left-panel/tabs/tasks/TasksTab/groupTasksForTab';
import { TaskDetailDrawer } from '../../../../../tasks/TaskDetailDrawer';
import { tasksForPatient } from './patientTasks';
import styles from './overviewCards.module.css';
import { CardHeaderActions, CardInsights } from '../attention/CardInsights';

const VISIBLE = 3;
const OWNER_OPTIONS = ['Mine', 'Others'];

export function TasksCard({ patient, actions }) {
  const allTasks = useAppStore(s => s.tasks);
  const fetchTasks = useAppStore(s => s.fetchTasks);
  const updateTask = useAppStore(s => s.updateTask);
  const [pickedTab, setTab] = useState(null);
  const [openTaskId, setOpenTaskId] = useState(null);
  const [insightsOpen, setInsightsOpen] = useState(false);
  // Mine / Others, so work someone else already owns isn't picked up twice.
  const [owner, setOwner] = useState([]);
  const myName = useAppStore(s => s.currentUserProfile?.name || '');
  const isMine = t => !!myName && t.assignee === myName;

  useEffect(() => { fetchTasks?.(); }, [fetchTasks]);

  const groups = useMemo(() => {
    const all = groupTasksForTab(tasksForPatient(allTasks, patient));
    if (owner.length !== 1) return all;
    const keep = owner[0] === 'Mine' ? (t => !!myName && t.assignee === myName) : (t => !myName || t.assignee !== myName);
    return { pending: all.pending.filter(keep), overdue: all.overdue.filter(keep), completed: all.completed.filter(keep) };
  }, [allTasks, patient, owner, myName]);
  // Until the user picks a tab, open on Overdue when nothing is merely open,
  // so the card never leads with an empty list while work is waiting.
  const tab = pickedTab ?? (groups.pending.length === 0 && groups.overdue.length > 0 ? 'overdue' : 'pending');
  const list = groups[tab] || [];
  const isOverdueTab = tab === 'overdue';
  // The drawer reads the live store task, so edits made in it show here.
  const openTask = openTaskId ? (allTasks || []).find(t => String(t.id) === String(openTaskId)) : null;

  const toggle = (task) => {
    if (tab === 'completed') updateTask(task.id, { status: 'pending', completed_at: null });
    else updateTask(task.id, { status: 'completed', completed_at: new Date().toISOString() });
  };

  return (
    <DashboardCard
      icon="solar:checklist-linear"
      title="Tasks"
      count={groups.pending.length + groups.overdue.length || null}
      actions={<CardHeaderActions insightsOpen={insightsOpen} onToggleInsights={() => setInsightsOpen(v => !v)}><Button variant="ghost" size="sm" onClick={actions.addTask}>Add task</Button></CardHeaderActions>}
    >
      <CardInsights open={insightsOpen} />
      <div className={`${styles.tabs} ${styles.tabsWithFilter}`}>
        <CountToggle
          items={[
            { key: 'pending', label: 'Open', count: groups.pending.length },
            { key: 'overdue', label: 'Overdue', count: groups.overdue.length },
            { key: 'completed', label: 'Completed' },
          ]}
          active={tab}
          onChange={setTab}
        />
        <FilterChip size="S" singleSelect label="Owner" options={OWNER_OPTIONS} selected={owner} onChange={setOwner} />
      </div>
      <DashboardCardBody className={styles.listBody}>
        {list.length === 0 ? (
          <p className={styles.empty}>{tab === 'completed' ? 'No completed tasks.' : isOverdueTab ? 'Nothing overdue.' : 'No open tasks.'}</p>
        ) : (
          <CappedRows
            items={list}
            limit={VISIBLE}
            resetKey={tab}
            render={t => (
          <div key={t.id} className={styles.clickRow}>
            <PanelSectionItem
              inset
              leading={(
                <span className={styles.leadPair}>
                  <span className={styles.aboveStretch}>
                    <Checkbox
                      checked={tab === 'completed'}
                      onCheckedChange={() => toggle(t)}
                      aria-label={tab === 'completed' ? `Reopen ${t.title}` : `Complete ${t.title}`}
                    />
                  </span>
                  <PriorityIcon priority={t.priority} title={`${t.priority} priority`} />
                </span>
              )}
              title={(
                <button type="button" className={`${styles.titleButton} ${styles.stretch}`} onClick={() => setOpenTaskId(t.id)}>
                  {t.title}
                </button>
              )}
              meta={[
                t.due && <span key="due" className={isOverdueTab ? styles.textError : undefined}>{isOverdueTab ? 'Overdue • ' : ''}Due {t.due}</span>,
                t.assignee && (isMine(t) ? 'You' : t.assignee),
              ]}
            />
          </div>
            )}
          />
        )}
      </DashboardCardBody>
      {openTask && (
        <TaskDetailDrawer
          task={openTask}
          onClose={() => setOpenTaskId(null)}
          onSelectTask={next => setOpenTaskId(next?.id ?? null)}
        />
      )}
    </DashboardCard>
  );
}
