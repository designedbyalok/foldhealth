import { useEffect } from 'react';
import { Badge } from '../../../../../../../components/Badge/Badge';
import { Button } from '../../../../../../../components/Button/Button';
import { DashboardCard } from '../../../../../../../components/DashboardCard/DashboardCard';
import { Icon } from '../../../../../../../components/Icon/Icon';
import { PanelSectionItem } from '../../../../../../../components/PanelSection/PanelSection';
import { useAppStore } from '../../../../../../../store/useAppStore';
import { findPatientRecord } from '../../care-plan/lib/carePlanPrintSettings';
import { EVENT_KINDS, openSuggestions, suggestionAction } from './programSuggestedActionsModel';
import { stepsFor } from '../../program-detail/ProgramDetailView/ProgramDetailView.utils';
import styles from './CareProgramsOverview.module.css';

const EMPTY = [];
// "eFax" or "ADT feed" only repeats the event's kind: leave it out.
const sourceOf = (r, kind) => (!r.eventSource || r.eventSource.toLowerCase().startsWith(kind.label.toLowerCase()) ? null : r.eventSource);

/**
 * What new events (ADT, eFax, imaging, labs) mean for the patient's care
 * programs: one suggestion per event, with the action it takes (enroll, open
 * a program step, create a task, or mark reviewed) and Dismiss. An enroll
 * suggestion resolves itself once the patient is enrolled. `programCode`
 * keeps it to one program's suggestions (its Overview step).
 */
export function ProgramSuggestedActions({ patientId, programs, onEnroll, onOpenStep, programCode = null }) {
  const memberId = useAppStore(s => String(findPatientRecord(s, patientId)?.memberId || patientId || ''));
  const rows = useAppStore(s => s.programEventSuggestions[memberId]) || EMPTY;
  const fetchSuggestions = useAppStore(s => s.fetchProgramEventSuggestions);
  const decide = useAppStore(s => s.decideProgramEventSuggestion);
  const createTask = useAppStore(s => s.createTask);
  const me = useAppStore(s => s.currentUserProfile);
  const showToast = useAppStore(s => s.showToast);
  const patientName = useAppStore(s => String(findPatientRecord(s, patientId)?.name || ''));
  useEffect(() => { if (memberId) fetchSuggestions(memberId); }, [memberId, fetchSuggestions]);

  // A program's own Overview shows only that program's suggestions.
  const open = openSuggestions(programCode ? rows.filter(r => r.programCode === programCode) : rows, programs);
  const resolved = open.filter(r => r.resolved);
  // Enrolled since the suggestion came in: it's done.
  useEffect(() => {
    for (const r of resolved) decide(memberId, r.id, 'done');
  }, [resolved.map(r => r.id).join('|'), memberId, decide]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = open.filter(r => !r.resolved);
  if (!shown.length) return null;

  const run = async (r) => {
    const a = suggestionAction(r, programs, stepsFor);
    if (a.kind === 'enroll') { onEnroll(r.action.code); return; }
    if (a.kind === 'step') { onOpenStep(a.program, a.stepId); decide(memberId, r.id, 'done'); return; }
    if (a.kind === 'task') {
      const created = await createTask({
        name: r.action.name, status: 'pending', priority: r.action.priority || 'medium', due_date: r.action.due,
        assigned_to: me?.name || '', assigned_to_id: me?.id || null, member: patientName, labels: [], meta: '',
        description: `Suggested from ${EVENT_KINDS[r.eventKind]?.label || 'an event'}: ${r.eventTitle} (${r.occurredAt}).`,
        pool: null, mentions: [], attachments: 0, comments: 0, is_subtask: false, parent_task: null, parent_task_id: null,
        program_code: r.programCode, patient_id: String(patientId),
      });
      if (created) { decide(memberId, r.id, 'done'); showToast(`Task created: ${r.action.name}`); }
      return;
    }
    decide(memberId, r.id, 'done');
    showToast('Marked reviewed');
  };

  return (
    <DashboardCard icon="solar:bolt-linear" title="Suggested Actions" count={shown.length} footer="From new ADT, eFax, imaging and lab events">
      <ul className={styles.sugList}>
        {shown.map(r => {
          const kind = EVENT_KINDS[r.eventKind] || EVENT_KINDS.lab;
          const a = suggestionAction(r, programs, stepsFor);
          return (
            <li key={r.id}>
              <PanelSectionItem
                inset
                alignTop
                wrapTitle
                leading={<Icon name={kind.icon} size={16} color="var(--primary-300)" />}
                title={r.suggestion}
                meta={[`${kind.label}: ${r.eventTitle}`, r.eventDetail, sourceOf(r, kind), r.occurredAt].filter(Boolean).join(' · ')}
                trailing={<Badge size="sm" label={r.programCode} />}
              >
                <span className={styles.sugActions}>
                  <Button variant="outline" size="sm" disabled={a.disabled} title={a.hint || undefined} onClick={() => run(r)}>{a.label}</Button>
                  <Button variant="ghost" size="sm" onClick={() => decide(memberId, r.id, 'dismissed')}>Dismiss</Button>
                </span>
              </PanelSectionItem>
            </li>
          );
        })}
      </ul>
    </DashboardCard>
  );
}
