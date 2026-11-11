import { useMemo, useState } from 'react';
import { Badge } from '@/components/Badge/Badge';
import { ActionButton } from '@/components/ActionButton/ActionButton';
import { MenuPopover } from '@/components/MenuPopover/MenuPopover';
import { AddIconMinimalist } from '@/components/Icon/AddIconMinimalist';
import { useAppStore } from '@/store/useAppStore';
import { CarePlanOverview } from '../../CarePlanView/CarePlanOverview';
import { GbiSectionHead } from '../../CarePlanView/CarePlanViewSections';
import { linkedForChild, linkedForGoal, noteSummaryLookup } from '../../CarePlanView/carePlanLinkedItems';
import { CarePlanGoalsTable } from '../../tables/CarePlanGoalsTable';
import { CarePlanInterventionsTable } from '../../tables/CarePlanInterventionsTable';
import { CarePlanBarriersTable } from '../../tables/CarePlanBarriersTable';
import { deriveGoalTableFields } from '../../lib/goalMetrics';
import { latestPlanNote } from '../../lib/carePlanNotes';
import { useCarePlanNoteRefs } from '../../lib/carePlanNoteRefs';
import styles from './CarePlanSummaryView.module.css';

const EMPTY = [];
const NOOP = () => {};
const ATTENTION_WORD = { goal: 'Off Target', intervention: 'Overdue', barrier: 'Without Intervention' };
const KIND_OF = { goal: 'goal', intv: 'intervention', barrier: 'barrier' };
// The All Programs row carries its program; the plan's own save takes the item.
const bare = ({ program, programCode, templateIds, duplicate, ...item }) => item; // eslint-disable-line no-unused-vars
const programTag = row => <Badge size="sm" label={row.programCode} />;

/**
 * The program's note card (Care Plan Note, Events Updates, Review Cadence)
 * for one program at a time, with ◀ CODE · 1 of N ▶ to step through the
 * programs, as the prototype's All view does. The summary and recent notes
 * are in the All Programs left column, so the card leaves them out.
 */
export function ProgramNoteCard({ patientId, patientName, programs, onOpenProgram, onOpenItem }) {
  const [index, setIndex] = useState(0);
  const n = programs.length;
  const i = Math.min(index, n - 1);
  const program = programs[i];
  const key = `${patientId}::${program.id}`;
  const live = useAppStore(s => s.patientCarePlans[key]);
  const audit = useAppStore(s => s.patientCarePlanAudit[key]) || EMPTY;
  const { mentionUsers, links } = useCarePlanNoteRefs(patientId, program.id);
  const note = useMemo(() => latestPlanNote(audit), [audit]);
  const at = d => programs[(i + d + n) % n];
  const nav = n > 1 ? (
    <span className={styles.noteNav} role="group" aria-label="Program note">
      <ActionButton icon="solar:alt-arrow-left-linear" size="sm" tooltip={`Previous: ${at(-1).code}`} onClick={() => setIndex((i - 1 + n) % n)} />
      <span aria-live="polite" className={styles.noteNavLabel}><strong>{program.code}</strong> · {i + 1} of {n}</span>
      <ActionButton icon="solar:alt-arrow-right-linear" size="sm" tooltip={`Next: ${at(1).code}`} tooltipLeft onClick={() => setIndex((i + 1) % n)} />
    </span>
  ) : <Badge size="sm" label={program.code} />;
  return (
    <CarePlanOverview
      patientId={patientId}
      program={program}
      patientName={patientName}
      live={live}
      audit={audit}
      canEdit
      noSummary
      nav={nav}
      latestPlanNote={note}
      mentionUsers={mentionUsers}
      linkItems={links}
      onOpenNoteHistory={() => onOpenProgram?.(program)}
      onOpenItem={onOpenItem}
    />
  );
}

/**
 * Goals, Interventions and Barriers in All Programs with the same tables,
 * columns and section heads as a program's plan, each row tagged with its
 * program. Every edit saves to the row's own program plan.
 */
export function AllProgramsGbiSections({
  patientId, carePlans, goals, interventions, barriers, attention, attentionOn, onToggleAttention,
  openSections, toggleSection, activeRowId, onOpen, onAdd, onPriorityMenu, onStatusMenu, onAssigneeChange,
  patients, platformUsers, onOpenProgram,
}) {
  const saveGoal = useAppStore(s => s.savePatientCarePlanGoal);
  const saveIntervention = useAppStore(s => s.savePatientCarePlanIntervention);
  const saveBarrier = useAppStore(s => s.savePatientCarePlanBarrier);
  const audits = useAppStore(s => s.patientCarePlanAudit);
  const noteReads = useAppStore(s => s.carePlanNoteReads);
  const me = useAppStore(s => s.currentUserProfile?.name || '');
  const [rowMenu, setRowMenu] = useState(null); // { kind, item, rect }

  const planOf = row => carePlans[`${patientId}::${row.program?.id}`];
  const goalRows = useMemo(
    () => goals.map(g => ({ ...g, ...deriveGoalTableFields(g, planOf(g)?.measurements || EMPTY) })),
    [goals, carePlans], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const goalTitles = useMemo(() => new Map(goals.map(g => [g.id, g.title])), [goals]);
  const programKey = [...new Set([...goals, ...interventions, ...barriers].map(r => r.program?.id))].join(',');
  const noteLookup = useMemo(
    () => noteSummaryLookup(programKey.split(',').flatMap(id => audits[`${patientId}::${id}`] || EMPTY), noteReads, me),
    [programKey, audits, noteReads, me, patientId],
  );
  const badge = row => (row.program?.name ? [row.program.name] : [row.programCode]);
  const linkedGoal = g => linkedForGoal(g, planOf(g), badge(g));
  const linkedChild = item => linkedForChild(item, planOf(item), badge(item));

  const flag = (kind) => {
    const count = attention.filter(a => a.kind === kind).length;
    if (!count) return null;
    return (
      <button
        type="button"
        className={styles.flagBtn}
        aria-pressed={attentionOn}
        title={attentionOn ? 'Show all items' : 'Show only what needs attention'}
        onClick={onToggleAttention}
      >
        <Badge tone={kind === 'barrier' ? 'warning' : 'danger'} size="sm" label={`${count} ${ATTENTION_WORD[kind]}`} />
      </button>
    );
  };
  const addButton = (kind, label) => (
    <ActionButton size="sm" tooltip={`Add ${label}`} onClick={e => onAdd(kind, e.currentTarget.getBoundingClientRect())}>
      <AddIconMinimalist size={16} color="var(--neutral-300)" />
    </ActionButton>
  );
  const openNotes = kind => item => onOpen(kind, item);
  const shared = {
    canEdit: true,
    bulkMode: false,
    selectedIds: EMPTY,
    onSelectAll: NOOP,
    onToggleSelect: NOOP,
    activeRowId,
    onPriorityMenu,
    onStatusMenu,
    onRowMenu: setRowMenu,
    titleBadge: programTag,
  };
  const empty = label => <div className={styles.emptyRow}>No {label} match.</div>;

  return (
    <>
      <div className={styles.section}>
        <GbiSectionHead
          title="Goals"
          flag={flag('goal')}
          count={goals.length}
          open={openSections.goals}
          onToggle={() => toggleSection('goals')}
          addButton={addButton('goal', 'goal')}
        />
        {openSections.goals && (
          <CarePlanGoalsTable
            {...shared}
            rows={goalRows}
            onOpenGoal={g => onOpen('goal', g)}
            onTargetDateChange={(g, iso) => saveGoal(patientId, g.program, { ...bare(g), targetDate: iso }, g.id)}
            onTitleChange={(g, title) => saveGoal(patientId, g.program, { ...bare(g), title }, g.id)}
            onOpenNotes={openNotes('goal')}
            hasNote={g => noteLookup('goal', g.id)}
            linked={linkedGoal}
            emptyState={empty('goals')}
          />
        )}
      </div>

      <div className={styles.section}>
        <GbiSectionHead
          title="Interventions"
          flag={flag('intervention')}
          count={interventions.length}
          open={openSections.interventions}
          onToggle={() => toggleSection('interventions')}
          addButton={addButton('intervention', 'intervention')}
        />
        {openSections.interventions && (
          <CarePlanInterventionsTable
            {...shared}
            rows={interventions}
            onOpenIntervention={i => onOpen('intervention', i)}
            onAssigneeChange={onAssigneeChange}
            onDueDateChange={(i, iso) => saveIntervention(patientId, i.program, {
              ...bare(i), config: { ...(i.config || {}), dueDateOverride: iso || '' },
            }, i.id)}
            onRecurrenceChange={(i, next) => saveIntervention(patientId, i.program, {
              ...bare(i), config: { ...(i.config || {}), ...next },
            }, i.id)}
            onTitleChange={(i, title) => saveIntervention(patientId, i.program, { ...bare(i), title }, i.id)}
            onOpenNotes={openNotes('intervention')}
            hasNote={i => noteLookup('intervention', i.id)}
            goalTitleOf={id => goalTitles.get(id)}
            linked={linkedChild}
            platformUsers={platformUsers}
            patients={patients}
            emptyState={empty('interventions')}
          />
        )}
      </div>

      <div className={styles.section}>
        <GbiSectionHead
          title="Barriers"
          flag={flag('barrier')}
          count={barriers.length}
          open={openSections.barriers}
          onToggle={() => toggleSection('barriers')}
          addButton={addButton('barrier', 'barrier')}
        />
        {openSections.barriers && (
          <CarePlanBarriersTable
            {...shared}
            rows={barriers}
            onOpenBarrier={b => onOpen('barrier', b)}
            onTitleChange={(b, title) => saveBarrier(patientId, b.program, { ...bare(b), title }, b.id)}
            onOpenNotes={openNotes('barrier')}
            hasNote={b => noteLookup('barrier', b.id)}
            linked={linkedChild}
            emptyState={empty('barriers')}
          />
        )}
      </div>

      {rowMenu && (
        <MenuPopover
          anchorRect={rowMenu.rect}
          width={220}
          ariaLabel="Row actions"
          items={[
            { key: 'open', icon: 'solar:eye-linear', label: 'View Details' },
            { key: 'program', icon: 'solar:square-top-down-linear', label: `Open ${rowMenu.item.programCode} Care Plan` },
          ]}
          onSelect={(k) => {
            const { kind, item } = rowMenu;
            setRowMenu(null);
            if (k === 'open') onOpen(KIND_OF[kind.replace('-menu', '')] || 'goal', item);
            else onOpenProgram?.(item.program);
          }}
          onClose={() => setRowMenu(null)}
        />
      )}
    </>
  );
}
