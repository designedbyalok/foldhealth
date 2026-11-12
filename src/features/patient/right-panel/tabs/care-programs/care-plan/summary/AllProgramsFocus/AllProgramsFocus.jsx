import { useCallback, useEffect, useMemo, useState } from 'react';
import { DashboardCard, DashboardCardBody } from '@/components/DashboardCard/DashboardCard';
import { Badge } from '@/components/Badge/Badge';
import { AddTaskDrawer } from '../../../../../../../tasks/AddTaskDrawer';
import { TasksCard } from '../../../../overview/cards/TasksCard';
import { useEventUpdates } from '../../CarePlanView/useEventUpdates';
import { SuggestedActionRow } from '../../CarePlanView/SuggestedActionsCard';
import { suggestionsOf } from '../../CarePlanView/suggestedActions';
import { FocusGroups } from '../../CarePlanView/FocusGroups';
import styles from '../../CarePlanView/CarePlanFocusPanel.module.css';

// One program's suggested changes (its own event updates), tagged with the
// program; it reports how many it has so the card can count them all.
function ProgramSuggestions({ patientId, program, live, onCount }) {
  const events = useEventUpdates({ patientId, program, live, evaluate: false });
  const rows = suggestionsOf(events);
  const n = events.loaded || events.missing ? rows.length : null;
  useEffect(() => { onCount(program.id, n); }, [program.id, n, onCount]);
  return rows.map(({ impact, change }) => (
    <SuggestedActionRow
      key={`${impact.id}:${change.id}`}
      events={events}
      impact={impact}
      change={change}
      canEdit
      trailing={<Badge size="sm" label={program.code} />}
    />
  ));
}

/**
 * The All Programs care plan's side panel while no item is open: Look at
 * These First across every plan (each row tagged with its program), the
 * changes every program's event updates suggest, and the patient's tasks.
 */
export function AllProgramsFocus({ patientId, patientName, attention, plans = [], onOpenItem }) {
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [counts, setCounts] = useState({}); // program id -> suggestions, null while loading
  const onCount = useCallback((id, n) => setCounts(prev => (prev[id] === n ? prev : { ...prev, [id]: n })), []);
  const loaded = plans.length > 0 && plans.every(p => counts[p.program.id] != null);
  const suggestionCount = plans.reduce((n, p) => n + (counts[p.program.id] || 0), 0);
  const patient = useMemo(() => ({ id: patientId, memberId: patientId, name: patientName }), [patientId, patientName]);
  return (
    <div className={styles.panel}>
      <DashboardCard icon="solar:danger-circle-linear" title="Look at These First" count={attention.length || null}>
        <DashboardCardBody className={styles.listBody}>
          {attention.length === 0 ? (
            <p className={styles.empty}>Nothing needs attention across the programs.</p>
          ) : (
            <FocusGroups items={attention} onOpen={f => onOpenItem(f.kind, f.item, f.program)} />
          )}
        </DashboardCardBody>
      </DashboardCard>
      {plans.length > 0 && (
        <DashboardCard icon="solar:lightbulb-minimalistic-linear" title="Suggested Actions" count={suggestionCount || null}>
          <DashboardCardBody className={styles.listBody}>
            {plans.map(({ program, carePlan }) => (
              <ProgramSuggestions key={program.id} patientId={patientId} program={program} live={carePlan} onCount={onCount} />
            ))}
            {loaded && suggestionCount === 0 && <p className={styles.empty}>No suggestions right now.</p>}
          </DashboardCardBody>
        </DashboardCard>
      )}
      <TasksCard patient={patient} actions={{ addTask: () => setAddTaskOpen(true) }} />
      {addTaskOpen && (
        <AddTaskDrawer initialMember={patientName} onClose={() => setAddTaskOpen(false)} onTaskCreated={() => setAddTaskOpen(false)} />
      )}
    </div>
  );
}
