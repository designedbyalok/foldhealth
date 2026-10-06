import { useEffect, useMemo, useRef, useState } from 'react';
import { Drawer } from '../../../../../components/Drawer/Drawer';
import { Button } from '../../../../../components/Button/Button';
import { Input } from '../../../../../components/Input/Input';
import { Textarea } from '../../../../../components/Textarea/Textarea';
import { Select } from '../../../../../components/Select/Select';
import { RadioButton } from '../../../../../components/RadioButton/RadioButton';
import { Switch } from '../../../../../components/Switch/Switch';
import { MenuPopover } from '../../../../../components/MenuPopover/MenuPopover';
import { DownChevronIcon } from '../../../../../components/Icon/DownChevronIcon';
import { Badge } from '../../../../../components/Badge/Badge';
import { PriorityIcon } from '../../../../../components/PriorityIcon/PriorityIcon';
import { VITAL_OPTIONS } from '../../lib/vitalOptions';
import { MEASURE_CONFIG } from '../../lib/goalFormat';
import { useAppStore } from '../../../../../store/useAppStore';
import { InterventionLibrarySelect } from '../shared/InterventionLibrarySelect';
import { InterventionKindToggle } from '../shared/InterventionKindToggle';
import { ActionButton } from '../../../../../components/ActionButton/ActionButton';
import { Icon } from '../../../../../components/Icon/Icon';
import { ActivityLog } from '../../../../../components/ActivityLog/ActivityLog';
import { AssigneeChange } from '../../../../../components/AssigneeChange/AssigneeChange';

const initialsOf = (name) => (name || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
import { LinkGoalToBarrierDrawer } from '../../../../patient/right-panel/tabs/care-programs/care-plan/drawers/BarrierDetailDrawer/LinkGoalToBarrierDrawer';
import { formatGoalTarget, formatGoalDuration } from '../../lib';
import styles from '../shared/InterventionDrawer.module.css';
// Reuse the tasks-view title styles so the Task Title in this drawer
// matches the care-plan Add Task drawer exactly (big 2xl label + input,
// char counter + red mandatory dot on the same header line, auto-grow
// textarea that wraps onto a second line).
import tasksViewStyles from '../../../../tasks/TasksView.module.css';

// Mirrors the barrier drawer's goal-type icon resolver so linked goal rows
// read identically across barrier + intervention surfaces.
function goalIconFor(goal) {
  const c = (goal?.category || goal?.type || '').toLowerCase();
  if (c.startsWith('vital')) return 'solar:heart-pulse-linear';
  if (c.startsWith('exercise') || c.startsWith('activity')) return 'solar:running-linear';
  if (c.startsWith('diet')) return 'solar:donut-linear';
  if (c.startsWith('lab')) return 'solar:test-tube-linear';
  if (c.startsWith('assessment')) return 'solar:clipboard-list-linear';
  return 'solar:target-linear';
}

const CREATION_TIMINGS = ['day', 'week', 'immediate'];
const CREATION_TRIGGERS = ['Program Start Date', 'Discharge Date', 'Care Plan Signed'];
const DUE_UNITS = ['day', 'week'];
// Capitalised in the repeat row, per Figma 12211:293048.
const REPEAT_UNITS = ['Days', 'Weeks'];
const PRIORITIES = ['High', 'Medium', 'Low'];
const TITLE_MAX = 150;
const EMPTY_AVAILABLE_GOALS = [];

const asOptions = (list) => list.map(v => ({ value: v, label: v }));

// Suffix each vital option with its unit (from MEASURE_CONFIG) so the
// picker reads e.g. "Blood Pressure (mmHg)". `value` stays the raw vital
// name so downstream lookups keep working.
const vitalOptionsWithUnits = (list) => list.map(v => {
  const cfg = MEASURE_CONFIG[v];
  let unit = '';
  if (cfg?.dual && Array.isArray(cfg.units) && cfg.units.length) {
    // Blood Pressure / Height use dual entries — collapse duplicates.
    unit = [...new Set(cfg.units.filter(Boolean))].join('/');
  } else if (cfg?.unit) {
    unit = cfg.unit;
  }
  return { value: v, label: unit ? `${v} (${unit})` : v };
});

const isTask = (kind) => kind === 'patient-task' || kind === 'internal-task';

/**
 * One drawer for every intervention kind. The kind decides which entity field
 * sits under the title — a form, an education item, a vital, or a plain
 * description — while title/priority, member task title and the task-date
 * block are common to all. Keeping it as a single component means switching
 * kind swaps the fields in place instead of tearing the drawer down.
 */
export function InterventionDrawer({
  onClose,
  onSave,
  intervention,
  kind = 'internal-task',
  onKindChange,
  title: titleOverride,
  // Optional Care Plan bindings — mirror the Barrier Detail Drawer:
  //   • linkToGoalsAllowed: show a Linked Goals section with a picker
  //     modelled on LinkGoalToBarrierDrawer. Hide entirely when the
  //     drawer is opened from a goal-scoped surface (that goal is the
  //     link).
  //   • availableGoals / linkedGoalIds: the plan's full goal list and
  //     the ids currently linked to this intervention.
  //   • activityEntries: pre-mapped audit rows in the shared
  //     ActivityLog entry shape. Rendered below the form when provided.
  linkToGoalsAllowed = false,
  availableGoals = EMPTY_AVAILABLE_GOALS,
  linkedGoalIds: linkedGoalIdsProp,
  activityEntries,
  // Patient name — surfaces as the read-only "Member" row. Interventions
  // authored on a plan always target that plan's patient, so it can't be
  // edited here; the Assigned To row is the mutable owner instead.
  memberName,
  // Opens a linked goal in its detail drawer — mirrors the barrier drawer's
  // Open Goal action so the intervention's linked goals surface the same
  // interaction. Optional; the arrow just no-ops when the caller omits it.
  onOpenGoal,
  // Offer a "From library" picker on a new intervention. Off for the
  // library's own editor, where the item being written is the library.
  showLibrary = false,
}) {
  const [linkedGoalIds, setLinkedGoalIds] = useState(() => (
    Array.isArray(linkedGoalIdsProp) && linkedGoalIdsProp.length > 0
      ? [...linkedGoalIdsProp]
      : (Array.isArray(intervention?.goalIds) ? [...intervention.goalIds] : [])
  ));
  const [linkGoalPickerOpen, setLinkGoalPickerOpen] = useState(false);
  const [linkedGoalsOpen, setLinkedGoalsOpen] = useState(true);
  const linkedGoals = useMemo(
    () => linkedGoalIds
      .map(id => availableGoals.find(g => g.id === id))
      .filter(Boolean),
    [linkedGoalIds, availableGoals],
  );
  const goalsForPicker = useMemo(
    () => availableGoals.filter(g => !linkedGoalIds.includes(g.id)),
    [availableGoals, linkedGoalIds],
  );
  const handleLinkGoals = (ids) => setLinkedGoalIds(prev => Array.from(new Set([...prev, ...ids])));
  const handleUnlinkGoal = (id) => setLinkedGoalIds(prev => prev.filter(x => x !== id));

  const [title, setTitle] = useState(intervention?.title ?? '');
  // Auto-grow the Task Title textarea to match the care-plan Add Task
  // drawer — long titles wrap onto a second line instead of scrolling
  // horizontally in a single-line input.
  const titleTextareaRef = useRef(null);
  useEffect(() => {
    const el = titleTextareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [title]);
  const [priority, setPriority] = useState(intervention?.priority ?? 'Medium');
  // Default the assignee to the current member for every kind EXCEPT
  // Internal Task, where the user picks a staff member instead. The
  // parent may resolve `memberName` async (worklist slice hydrates after
  // mount), so sync on arrival while leaving explicit user picks alone.
  useEffect(() => {
    if (kind === 'internal-task') return;
    if (memberName && !assignedToInitialized.current) {
      setAssignedTo(prev => prev || memberName);
      assignedToInitialized.current = true;
    }
  }, [memberName, kind]); // eslint-disable-line react-hooks/exhaustive-deps
  const [form, setForm] = useState(intervention?.form ?? '');
  const [content, setContent] = useState(intervention?.content ?? '');
  const [vital, setVital] = useState(intervention?.vital ?? '');
  const [note, setNote] = useState(intervention?.note ?? '');
  const [description, setDescription] = useState(intervention?.description ?? '');
  const [assignedTo, setAssignedTo] = useState(intervention?.assignedTo ?? '');
  const assignedToInitialized = useRef(!!intervention?.assignedTo);
  const [member, setMember] = useState(intervention?.member ?? '');
  const [creationTiming, setCreationTiming] = useState(intervention?.creationTiming ?? 'immediate');
  const [creationCount, setCreationCount] = useState(intervention?.creationCount ?? '1');
  const [creationTrigger, setCreationTrigger] = useState(intervention?.creationTrigger ?? 'Care Plan Signed');
  const [dueOffset, setDueOffset] = useState(intervention?.dueOffset ?? '7');
  const [dueUnit, setDueUnit] = useState(intervention?.dueUnit ?? 'day');
  const [durationType, setDurationType] = useState(intervention?.durationType ?? 'calendar');
  const [repeat, setRepeat] = useState(intervention?.repeat ?? false);
  const [repeatCount, setRepeatCount] = useState(intervention?.repeatCount ?? '1');
  const [repeatEvery, setRepeatEvery] = useState(intervention?.repeatEvery ?? '1');
  const [repeatEveryUnit, setRepeatEveryUnit] = useState(intervention?.repeatEveryUnit ?? 'Days');
  const [repeatEnds, setRepeatEnds] = useState(intervention?.repeatEnds ?? '8');
  const [repeatEndsUnit, setRepeatEndsUnit] = useState(intervention?.repeatEndsUnit ?? 'Days');
  const [repeatEveryUnitOpen, setRepeatEveryUnitOpen] = useState(false);
  const [repeatEndsUnitOpen, setRepeatEndsUnitOpen] = useState(false);
  const repeatEveryUnitRef = useRef(null);
  const repeatEndsUnitRef = useRef(null);
  const [dueUnitOpen, setDueUnitOpen] = useState(false);
  const dueUnitRef = useRef(null);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const priorityRef = useRef(null);
  const [creationTimingOpen, setCreationTimingOpen] = useState(false);
  const creationTimingRef = useRef(null);
  const [creationTriggerOpen, setCreationTriggerOpen] = useState(false);
  const creationTriggerRef = useRef(null);

  // Assignee + member options mirror the AddTaskDrawer's dropdowns so the
  // Send Form / Send Content / etc. drawer stays consistent with task
  // inline editing.
  const platformUsers = useAppStore(s => s.platformUsers) || [];
  const patients = useAppStore(s => s.patients) || [];
  // AssigneeChange's picker takes `{id, name, initials, role?}` rows. Combine
  // platform users + patients so an intervention can be assigned to either
  // an internal user or the member themselves (Figma 8521:289961).
  const assigneeUsers = useMemo(() => ([
    ...platformUsers.map(u => ({
      id: u.id || `user:${u.name}`,
      name: u.name,
      initials: u.initials || initialsOf(u.name),
      role: u.role || 'User',
    })),
    ...patients.map(p => ({
      id: p.id || `member:${p.name}`,
      name: p.name,
      initials: p.initials || initialsOf(p.name),
      role: 'Member',
      avatarVariant: 'patient',
    })),
  ]), [platformUsers, patients]);
  // Forms and education content both come from Settings → Content. Search is
  // remote so a picker isn't limited to the first page.
  const contentForms = useAppStore(s => s.contentForms);
  const contentEmails = useAppStore(s => s.contentEmails);
  const contentFormsLoading = useAppStore(s => s.contentFormsLoading);
  const contentEmailsLoading = useAppStore(s => s.contentEmailsLoading);
  const fetchContentForms = useAppStore(s => s.fetchContentForms);
  const fetchContentEmails = useAppStore(s => s.fetchContentEmails);
  const [contentQuery, setContentQuery] = useState('');

  const needsForms = kind === 'send-form';
  const needsContent = kind === 'patient-education';

  useEffect(() => {
    if (!needsForms && !needsContent) return undefined;
    const term = contentQuery.trim();
    const timer = setTimeout(() => {
      if (needsForms || needsContent) fetchContentForms?.({ page: 1, perPage: 50, search: term });
      if (needsContent) fetchContentEmails?.({ page: 1, perPage: 50, search: term });
    }, 300);
    return () => clearTimeout(timer);
  }, [needsForms, needsContent, contentQuery, fetchContentForms, fetchContentEmails]);

  const formOptions = useMemo(
    () => (contentForms || []).map(f => ({ value: f.id, label: f.name })),
    [contentForms],
  );

  // Education material is anything authored in Content: emails and forms in
  // one picker, prefixed because the two id spaces overlap.
  const contentOptions = useMemo(() => {
    const emails = (contentEmails || []).map(e => ({ value: `email:${e.id}`, label: e.name }));
    const forms = (contentForms || []).map(f => ({ value: `form:${f.id}`, label: f.name }));
    return [
      ...(emails.length ? [{ type: 'header', value: 'header:emails', label: 'Emails' }, ...emails] : []),
      ...(forms.length ? [{ type: 'header', value: 'header:forms', label: 'Forms' }, ...forms] : []),
    ];
  }, [contentEmails, contentForms]);

  const entityFilled = needsForms ? String(form ?? '').length > 0
    : needsContent ? String(content ?? '').length > 0
      : kind === 'measure-vital' ? String(vital ?? '').length > 0
        : true;
  const canSave = title.trim().length > 0 && entityFilled;

  const headerRight = (
    <>
      <Button
        variant="primary"
        size="L"
        disabled={!canSave}
        onClick={() => onSave?.({
          kind,
          title: title.trim(),
          priority,
          form,
          content,
          vital,
          note: note.trim(),
          description: description.trim(),
          creationTiming,
          creationCount,
          creationTrigger,
          dueOffset,
          dueUnit,
          durationType,
          repeat,
          repeatCount,
          repeatEvery,
          repeatEveryUnit,
          repeatEnds,
          repeatEndsUnit,
          goalIds: linkedGoalIds,
          assignedTo,
          member,
        })}
      >
        {intervention ? 'Update' : 'Add'}
      </Button>
      <span className={styles.headerDivider} />
    </>
  );

  const unitField = (value, onValueChange, unit, onUnitSelect, open, setOpen, ref, label) => (
    <div className={styles.repeatField}>
      <Input
        value={value}
        onChange={e => onValueChange(e.target.value.replace(/\D/g, ''))}
        inputMode="numeric"
        aria-label={label}
        wrapperClassName={styles.offsetInput}
        trailingTextSegment
        trailingText={(
          <span className={styles.offsetTrailing}>
            <span className={styles.spinner}>
              <button
                type="button"
                className={styles.spinnerBtn}
                aria-label={`Increment ${label.toLowerCase()}`}
                onClick={() => onValueChange(String((Number(value) || 0) + 1))}
              >
                <Icon name="solar:alt-arrow-up-linear" size={10} color="var(--neutral-300)" />
              </button>
              <button
                type="button"
                className={styles.spinnerBtn}
                aria-label={`Decrement ${label.toLowerCase()}`}
                onClick={() => onValueChange(String(Math.max(1, (Number(value) || 0) - 1)))}
              >
                <Icon name="solar:alt-arrow-down-linear" size={10} color="var(--neutral-300)" />
              </button>
            </span>
            <button
              ref={ref}
              type="button"
              className={styles.unitTrigger}
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={() => setOpen(v => !v)}
            >
              {unit}
              <DownChevronIcon size={14} color="var(--neutral-300)" />
            </button>
          </span>
        )}
      />
      {open && (
        <MenuPopover
          anchorRef={ref}
          align="right"
          width={140}
          ariaLabel={`${label} unit`}
          items={REPEAT_UNITS.map(u => ({ key: u, label: u }))}
          onSelect={onUnitSelect}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );

  // The type toggle lives inside the drawer, so the heading stays put while
  // you switch kinds rather than renaming itself on every click.
  const heading = titleOverride || (intervention ? 'Edit Intervention' : 'Add Intervention');

  return (
    <Drawer title={heading} onClose={onClose} headerRight={headerRight} noCloseDivider>
      <div className={styles.body}>
        <InterventionKindToggle kind={kind} onKindChange={onKindChange} />
        {showLibrary && !intervention && (
          <InterventionLibrarySelect
            key={kind}
            kind={kind}
            onPick={(item) => {
              setTitle(item.title || '');
              setDescription(item.description || '');
              const p = String(item.config?.priority || '').toLowerCase();
              if (p === 'high' || p === 'medium' || p === 'low') setPriority(p[0].toUpperCase() + p.slice(1));
            }}
          />
        )}

        {/* Task Title — reuses the care-plan Add Task drawer's title
            treatment: big 2xl label + auto-growing textarea, char
            counter + red mandatory dot on the same header line. Priority
            lives in its own detail row below. */}
        <div className={tasksViewStyles.drawerSection}>
          <div className={styles.titleRow}>
            <span className={tasksViewStyles.drawerSectionLabel}>
              Task Title
              <span className={styles.mandatoryDotInline} aria-hidden="true" />
            </span>
            <span className={`${tasksViewStyles.charCount} ${title.length > TITLE_MAX ? tasksViewStyles.charCountOver : ''}`}>
              {title.length}/{TITLE_MAX}
            </span>
          </div>
          <textarea
            ref={titleTextareaRef}
            aria-label="Task Title"
            className={`${tasksViewStyles.drawerTaskTitleInput} ${styles.titleTextarea} ${title.length > TITLE_MAX ? tasksViewStyles.inputInvalid : ''}`}
            placeholder="Enter task title..."
            rows={1}
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </div>

        {needsForms && (
          <div className={styles.field}>
            <Select
              label="Select Form"
              required
              options={formOptions}
              value={form}
              onChange={setForm}
              placeholder="Search Form"
              searchable
              searchPlaceholder="Search Form"
              query={contentQuery}
              onQueryChange={setContentQuery}
              searchLoading={contentFormsLoading}
              emptyText={contentFormsLoading ? 'Loading forms…' : 'No forms found'}
            />
          </div>
        )}

        {needsContent && (
          <div className={styles.field}>
            <Select
              label="Member Education"
              required
              options={contentOptions}
              value={content}
              onChange={setContent}
              placeholder="Search Content"
              searchable
              searchPlaceholder="Search Content"
              query={contentQuery}
              onQueryChange={setContentQuery}
              searchLoading={contentEmailsLoading || contentFormsLoading}
              emptyText={contentEmailsLoading || contentFormsLoading ? 'Loading content…' : 'No content found'}
            />
          </div>
        )}

        {kind === 'measure-vital' && (
          <div className={styles.field}>
            <Select
              label="Vital"
              required
              options={vitalOptionsWithUnits(VITAL_OPTIONS)}
              value={vital}
              onChange={setVital}
              placeholder="Search Vital"
              searchable
              searchPlaceholder="Search Vital"
            />
          </div>
        )}

        {/* Description — same Textarea treatment as the care-plan Patient
            Task drawer (rich-text + attachment) so every intervention
            kind's long-form field reads and behaves the same. */}
        {(isTask(kind) || kind === 'measure-vital') && (
          <Textarea
            title="Description"
            richText
            attachment
            placeholder="Add a description..."
            value={description}
            rows={3}
            onChange={(html) => setDescription(typeof html === 'string' ? html : (html?.target?.value ?? ''))}
          />
        )}


        {/* Assignee / Member — mirrors the AddTaskDrawer inline detail
            rows so the fields read the same wherever an intervention
            surfaces as a task. Borderless DetailDropdown values keep
            the row visually calm — no double borders / boxes. */}
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>
            Assigned To
          </span>
          <AssigneeChange
            name={assignedTo}
            initials={initialsOf(assignedTo)}
            unassigned={!assignedTo}
            unassignedLabel="Select assignee"
            size="S"
            showRole={false}
            users={assigneeUsers}
            // If the current assignee is the member, render the trigger
            // with the patient avatar variant to match the picker row.
            avatarVariant={assignedTo && assignedTo === memberName ? 'patient' : 'staff'}
            onSelect={(u) => setAssignedTo(u?.name || '')}
            pickerTitle="Assign to"
            // Only Internal Task lets the user reassign — every other
            // intervention kind runs on the member and the assignee
            // stays locked to them.
            disabled={kind !== 'internal-task'}
          />
        </div>
        {/* Priority — was inline in the Title field, now its own row so
            the layout matches the care-plan Add Task drawer. */}
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Priority</span>
          <button
            ref={priorityRef}
            type="button"
            className={styles.priorityRowTrigger}
            aria-label={`Priority: ${priority}`}
            aria-haspopup="menu"
            aria-expanded={priorityOpen}
            onClick={() => setPriorityOpen(v => !v)}
          >
            <PriorityIcon priority={priority.toLowerCase()} size={16} />
            <span>{priority}</span>
            <DownChevronIcon size={12} color="var(--neutral-300)" />
          </button>
          {priorityOpen && (
            <MenuPopover
              anchorRef={priorityRef}
              align="left"
              width={140}
              ariaLabel="Intervention priority"
              items={PRIORITIES.map(p => ({
                key: p,
                label: p,
                iconElement: <PriorityIcon priority={p.toLowerCase()} size={16} />,
              }))}
              onSelect={setPriority}
              onClose={() => setPriorityOpen(false)}
            />
          )}
        </div>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>
            Member<span className={styles.mandatoryDot} aria-hidden="true" />
          </span>
          <AssigneeChange
            name={memberName}
            initials={initialsOf(memberName)}
            unassigned={!memberName}
            unassignedLabel="—"
            size="S"
            showRole={false}
            avatarVariant="patient"
            disabled
          />
        </div>

        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>
            Creation Date<span className={styles.mandatoryDot} aria-hidden="true" />
          </span>
          <div className={styles.inlineRow}>
            {creationTiming === 'immediate' ? (
              <button
                ref={creationTimingRef}
                type="button"
                className={styles.badgeTrigger}
                aria-haspopup="menu"
                aria-expanded={creationTimingOpen}
                onClick={() => setCreationTimingOpen(v => !v)}
              >
                <Badge tone="white" size="M" label="immediate" chevron />
              </button>
            ) : (
              <Input
                value={creationCount}
                onChange={e => setCreationCount(e.target.value.replace(/\D/g, ''))}
                inputMode="numeric"
                aria-label="Creation count"
                wrapperClassName={styles.offsetInput}
                trailingTextSegment
                trailingText={(
                  <span className={styles.offsetTrailing}>
                    <span className={styles.spinner}>
                      <button
                        type="button"
                        className={styles.spinnerBtn}
                        aria-label="Increment"
                        onClick={() => setCreationCount(String((Number(creationCount) || 0) + 1))}
                      >
                        <Icon name="solar:alt-arrow-up-linear" size={10} color="var(--neutral-300)" />
                      </button>
                      <button
                        type="button"
                        className={styles.spinnerBtn}
                        aria-label="Decrement"
                        onClick={() => setCreationCount(String(Math.max(1, (Number(creationCount) || 0) - 1)))}
                      >
                        <Icon name="solar:alt-arrow-down-linear" size={10} color="var(--neutral-300)" />
                      </button>
                    </span>
                    <button
                      ref={creationTimingRef}
                      type="button"
                      className={styles.unitTrigger}
                      aria-haspopup="menu"
                      aria-expanded={creationTimingOpen}
                      onClick={() => setCreationTimingOpen(v => !v)}
                    >
                      {creationTiming}
                      <DownChevronIcon size={14} color="var(--neutral-300)" />
                    </button>
                  </span>
                )}
              />
            )}
            {creationTimingOpen && (
              <MenuPopover
                anchorRef={creationTimingRef}
                align="left"
                width={160}
                ariaLabel="Creation timing"
                items={CREATION_TIMINGS.map(t => ({ key: t, label: t }))}
                onSelect={(t) => {
                  setCreationTiming(t);
                  if (t !== 'immediate' && !creationCount) setCreationCount('1');
                }}
                onClose={() => setCreationTimingOpen(false)}
              />
            )}
            <span className={styles.inlineText}>After</span>
            <button
              ref={creationTriggerRef}
              type="button"
              className={styles.badgeTrigger}
              aria-haspopup="menu"
              aria-expanded={creationTriggerOpen}
              onClick={() => setCreationTriggerOpen(v => !v)}
            >
              <Badge tone="white" size="M" label={creationTrigger} chevron />
            </button>
            {creationTriggerOpen && (
              <MenuPopover
                anchorRef={creationTriggerRef}
                align="left"
                width={220}
                ariaLabel="Creation trigger"
                items={CREATION_TRIGGERS.map(t => ({ key: t, label: t }))}
                onSelect={setCreationTrigger}
                onClose={() => setCreationTriggerOpen(false)}
              />
            )}
          </div>
        </div>

        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>
            Due Date<span className={styles.mandatoryDot} aria-hidden="true" />
          </span>
          <div className={styles.inlineRow}>
            <Input
              value={dueOffset}
              onChange={e => setDueOffset(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              aria-label="Due date offset"
              wrapperClassName={styles.offsetInput}
              trailingTextSegment
              trailingText={(
                <span className={styles.offsetTrailing}>
                  <span className={styles.spinner}>
                    <button
                      type="button"
                      className={styles.spinnerBtn}
                      aria-label="Increment"
                      onClick={() => setDueOffset(String((Number(dueOffset) || 0) + 1))}
                    >
                      <Icon name="solar:alt-arrow-up-linear" size={10} color="var(--neutral-300)" />
                    </button>
                    <button
                      type="button"
                      className={styles.spinnerBtn}
                      aria-label="Decrement"
                      onClick={() => setDueOffset(String(Math.max(0, (Number(dueOffset) || 0) - 1)))}
                    >
                      <Icon name="solar:alt-arrow-down-linear" size={10} color="var(--neutral-300)" />
                    </button>
                  </span>
                  <button
                    ref={dueUnitRef}
                    type="button"
                    className={styles.unitTrigger}
                    aria-haspopup="menu"
                    aria-expanded={dueUnitOpen}
                    onClick={() => setDueUnitOpen(v => !v)}
                  >
                    {dueUnit}
                    <DownChevronIcon size={14} color="var(--neutral-300)" />
                  </button>
                </span>
              )}
            />
            {dueUnitOpen && (
              <MenuPopover
                anchorRef={dueUnitRef}
                align="right"
                width={140}
                ariaLabel="Due date unit"
                items={DUE_UNITS.map(u => ({ key: u, label: u }))}
                onSelect={setDueUnit}
                onClose={() => setDueUnitOpen(false)}
              />
            )}
            <span className={styles.inlineText}>After Task Creation Date</span>
          </div>
        </div>

        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>
            Duration Type<span className={styles.mandatoryDot} aria-hidden="true" />
          </span>
          <div className={styles.radioRow} role="radiogroup" aria-label="Duration Type">
            <RadioButton
              checked={durationType === 'business'}
              onChange={() => setDurationType('business')}
              label="Business Days"
            />
            <RadioButton
              checked={durationType === 'calendar'}
              onChange={() => setDurationType('calendar')}
              label="Calendar Days"
            />
          </div>
        </div>

        {/* Repeat toggle — simple Switch with "Repeat" label, positioned
            directly under Duration Type (Figma 8521:289961). When on, the
            count / every / ends fields expand inline below. */}
        <div className={styles.repeatBlock}>
          <Switch checked={repeat} onChange={setRepeat} label="Repeat" size="S" />
          {repeat && (
            <div className={styles.repeatRow}>
              <Input
                value={repeatCount}
                onChange={e => setRepeatCount(e.target.value.replace(/\D/g, ''))}
                inputMode="numeric"
                aria-label="Repeat count"
                wrapperClassName={styles.offsetInput}
                trailingTextSegment
                trailingText={(
                  <span className={styles.offsetTrailing}>
                    <span className={styles.spinner}>
                      <button
                        type="button"
                        className={styles.spinnerBtn}
                        aria-label="Increment repeat count"
                        onClick={() => setRepeatCount(String((Number(repeatCount) || 0) + 1))}
                      >
                        <Icon name="solar:alt-arrow-up-linear" size={10} color="var(--neutral-300)" />
                      </button>
                      <button
                        type="button"
                        className={styles.spinnerBtn}
                        aria-label="Decrement repeat count"
                        onClick={() => setRepeatCount(String(Math.max(1, (Number(repeatCount) || 0) - 1)))}
                      >
                        <Icon name="solar:alt-arrow-down-linear" size={10} color="var(--neutral-300)" />
                      </button>
                    </span>
                    <span className={styles.unitStatic}>
                      {Number(repeatCount) === 1 ? 'time' : 'times'}
                    </span>
                  </span>
                )}
              />
              <span className={styles.inlineText}>after</span>
              {unitField(
                repeatEvery, setRepeatEvery, repeatEveryUnit, setRepeatEveryUnit,
                repeatEveryUnitOpen, setRepeatEveryUnitOpen, repeatEveryUnitRef, 'Repeat every',
              )}
              <span className={styles.inlineText}>Ends in</span>
              {unitField(
                repeatEnds, setRepeatEnds, repeatEndsUnit, setRepeatEndsUnit,
                repeatEndsUnitOpen, setRepeatEndsUnitOpen, repeatEndsUnitRef, 'Ends in',
              )}
            </div>
          )}
        </div>

            {/* Linked Goals — same collapsible section + row treatment
                the Barrier Detail Drawer uses (icon + title/subtitle +
                open/unlink cluster), so linked-goal rows read identically
                across barrier and intervention surfaces. */}
            {linkToGoalsAllowed && (
              <section className={styles.linkedSection}>
                <div className={styles.linkedSectionHead}>
                  <button
                    type="button"
                    className={styles.linkedSectionToggle}
                    onClick={() => setLinkedGoalsOpen(v => !v)}
                    aria-expanded={linkedGoalsOpen}
                  >
                    <span className={styles.linkedSectionTitle}>Linked Goals</span>
                    <DownChevronIcon
                      size={12}
                      color="var(--neutral-400)"
                      className={`${styles.linkedSectionChevron} ${linkedGoalsOpen ? styles.linkedSectionChevronOpen : ''}`}
                    />
                  </button>
                  <ActionButton
                    icon="solar:add-linear"
                    size="S"
                    tooltip="Link goal"
                    onClick={() => setLinkGoalPickerOpen(true)}
                    disabled={goalsForPicker.length === 0}
                  />
                </div>
                {linkedGoalsOpen && (
                  linkedGoals.length === 0 ? (
                    <div className={styles.linkedEmptyCard}>
                      <span className={styles.linkedEmptyIcon}>
                        <Icon name="solar:target-linear" size={16} color="var(--neutral-300)" />
                      </span>
                      <span className={styles.linkedEmptyText}>No Goals linked</span>
                      <button
                        type="button"
                        className={styles.linkedEmptyLink}
                        onClick={() => setLinkGoalPickerOpen(true)}
                        disabled={goalsForPicker.length === 0}
                      >
                        Link Goals
                      </button>
                    </div>
                  ) : (
                    <ul className={styles.linkList}>
                      {linkedGoals.map(g => {
                        const target = formatGoalTarget(g);
                        const duration = formatGoalDuration(g);
                        const subtitle = [target, duration].filter(Boolean).join(' for ');
                        return (
                          <li key={g.id} className={styles.linkRow}>
                            <span className={styles.linkIcon}>
                              <Icon name={goalIconFor(g)} size={16} color="var(--neutral-400)" />
                            </span>
                            <div className={styles.linkStack}>
                              <span className={styles.linkTitle}>{g.title}</span>
                              {subtitle && <span className={styles.linkSubtitle}>{subtitle}</span>}
                            </div>
                            <div className={styles.linkActions}>
                              <ActionButton
                                icon="solar:arrow-right-up-linear"
                                size="S"
                                tooltip="Open goal"
                                onClick={() => onOpenGoal?.(g)}
                              />
                              <span className={styles.linkActionsDivider} aria-hidden />
                              <ActionButton
                                icon="solar:link-broken-minimalistic-linear"
                                size="S"
                                tooltip="Unlink"
                                onClick={() => handleUnlinkGoal(g.id)}
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )
                )}
              </section>
            )}

            {/* Activity Log — pre-mapped audit rows in the shared
                ActivityLog primitive, same shape the Barrier Detail
                Drawer uses. Silent when no history yet. */}
            {Array.isArray(activityEntries) && activityEntries.length > 0 && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Activity Log</span>
                <ActivityLog entries={activityEntries} />
              </div>
            )}
      </div>
      {linkGoalPickerOpen && (
        <LinkGoalToBarrierDrawer
          goals={goalsForPicker}
          title="Link Goal to Intervention"
          onClose={() => setLinkGoalPickerOpen(false)}
          onLink={handleLinkGoals}
        />
      )}
    </Drawer>
  );
}
