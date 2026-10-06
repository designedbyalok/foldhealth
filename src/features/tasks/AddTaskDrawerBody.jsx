import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../components/Icon/Icon';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Button } from '../../components/Button/Button';
import { Badge } from '../../components/Badge/Badge';
import { Avatar } from '../../components/Avatar/Avatar';
import { Select } from '../../components/Select/Select';
import { Input } from '../../components/Input/Input';
import { Textarea } from '../../components/Textarea/Textarea';
import { RadioButton } from '../../components/RadioButton/RadioButton';
import { Switch } from '../../components/Switch/Switch';
import { MenuPopover } from '../../components/MenuPopover/MenuPopover';
import { DownChevronIcon } from '../../components/Icon/DownChevronIcon';
import { PriorityIcon } from './TasksViewIcons';
import { TaskDatePicker, DetailDropdown, CreatableLabelDropdown } from './TasksViewDropdowns';
import { LinkGoalToBarrierDrawer } from '../patient/right-panel/tabs/care-programs/care-plan/drawers/BarrierDetailDrawer/LinkGoalToBarrierDrawer';
import { formatGoalTarget, formatGoalDuration } from '../settings/care-plan-library/lib';
import styles from './TasksView.module.css';
import scheduleStyles from '../settings/care-plan-library/interventions/shared/InterventionDrawer.module.css';
import { InterventionLibrarySelect } from '../settings/care-plan-library/interventions/shared/InterventionLibrarySelect';

const CREATION_TIMINGS = ['day', 'week', 'immediate'];
const CREATION_TRIGGERS = ['Program Start Date', 'Discharge Date', 'Care Plan Signed'];
const DUE_UNITS = ['day', 'week'];
const REPEAT_UNITS = ['Days', 'Weeks'];

function goalIconFor(goal) {
  const c = (goal?.category || goal?.type || '').toLowerCase();
  if (c.startsWith('vital')) return 'solar:heart-pulse-linear';
  if (c.startsWith('exercise') || c.startsWith('activity')) return 'solar:running-linear';
  if (c.startsWith('diet')) return 'solar:donut-linear';
  if (c.startsWith('lab')) return 'solar:test-tube-linear';
  if (c.startsWith('assessment')) return 'solar:clipboard-list-linear';
  return 'solar:target-linear';
}

export function AddTaskDrawerBody({
  name, setName,
  status, setStatus,
  priority, setPriority,
  dueDate, setDueDate,
  assignedTo, setAssignedTo,
  member, setMember,
  pool, setPool,
  description,
  setDescription,
  selectedLabels, toggleLabel,
  showAddSubtask, setShowAddSubtask,
  subtaskName, setSubtaskName,
  stagedSubtasks,
  editorRef,
  assigneeOptions,
  memberOptions,
  taskPools,
  currentUserProfile,
  addStagedSubtask,
  removeStagedSubtask,
  updateStagedSubtask,
  STATUS_ORDER,
  STATUS_LABELS,
  PRIORITY_OPTIONS,
  TITLE_MAX,
  // Schedule fields (Creation Date / Due Date / Duration Type / Repeat).
  creationTiming, setCreationTiming,
  creationCount, setCreationCount,
  creationTrigger, setCreationTrigger,
  dueOffset, setDueOffset,
  dueUnit, setDueUnit,
  durationType, setDurationType,
  repeat, setRepeat,
  repeatCount, setRepeatCount,
  repeatEvery, setRepeatEvery,
  repeatEveryUnit, setRepeatEveryUnit,
  repeatEnds, setRepeatEnds,
  repeatEndsUnit, setRepeatEndsUnit,
  // Linked Goals.
  linkedGoalIds = [],
  linkGoal,
  unlinkGoal,
  availableGoals = [],
  onOpenGoal,
  // Only care-plan-scoped mounts opt in to the schedule block + Linked
  // Goals section. The plain Tasks-list drawer keeps its original layout.
  showScheduleFields = false,
  // Care-plan kind — 'patient-task' (default) or 'internal-task'. Internal
  // tasks hide Task Pool / Repeat / Subtasks and keep the Assigned To
  // picker limited to platform users (no members).
  taskKind,
  // Care plan task interventions: offer the intervention library of this
  // kind above the title.
  libraryKind,
}) {
  const isInternalTask = taskKind === 'internal-task';
  const [creationTimingOpen, setCreationTimingOpen] = useState(false);
  const [creationTriggerOpen, setCreationTriggerOpen] = useState(false);
  const [dueUnitOpen, setDueUnitOpen] = useState(false);
  const [repeatEveryUnitOpen, setRepeatEveryUnitOpen] = useState(false);
  const [repeatEndsUnitOpen, setRepeatEndsUnitOpen] = useState(false);
  const [linkGoalPickerOpen, setLinkGoalPickerOpen] = useState(false);
  const [linkedGoalsOpen, setLinkedGoalsOpen] = useState(true);
  const [subtasksOpen, setSubtasksOpen] = useState(true);
  const [editingSubtaskIdx, setEditingSubtaskIdx] = useState(null);
  const [editingSubtaskText, setEditingSubtaskText] = useState('');
  const titleTextareaRef = useRef(null);
  useEffect(() => {
    const el = titleTextareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [name, showScheduleFields]);
  const creationTimingRef = useRef(null);
  const creationTriggerRef = useRef(null);
  const dueUnitRef = useRef(null);
  const repeatEveryUnitRef = useRef(null);
  const repeatEndsUnitRef = useRef(null);

  const linkedGoals = linkedGoalIds
    .map(id => availableGoals.find(g => g.id === id))
    .filter(Boolean);
  const goalsForPicker = availableGoals.filter(g => !linkedGoalIds.includes(g.id));

  // In care-plan scope, an intervention/task may be assigned to a platform
  // user OR the member (patient). Merge memberOptions into assigneeOptions
  // so members appear in the picker alongside users; dedupe by name.
  const assigneeChoices = useMemo(() => {
    // Internal tasks are always assigned to a platform user; skip the
    // member merge so the picker stays user-only.
    if (!showScheduleFields || isInternalTask) return assigneeOptions;
    const merged = [...(assigneeOptions || [])];
    const seen = new Set(merged.map(o => (typeof o === 'string' ? o : o.value)));
    (memberOptions || []).forEach(m => {
      const name = typeof m === 'string' ? m : m.value;
      if (!name || seen.has(name)) return;
      merged.push({ value: name, label: name });
      seen.add(name);
    });
    return merged;
  }, [showScheduleFields, isInternalTask, assigneeOptions, memberOptions]);

  const unitField = (value, onValueChange, unit, onUnitSelect, open, setOpen, ref, label) => (
    <div className={scheduleStyles.repeatField}>
      <Input
        value={value}
        onChange={e => onValueChange(e.target.value.replace(/\D/g, ''))}
        inputMode="numeric"
        aria-label={label}
        wrapperClassName={scheduleStyles.offsetInput}
        trailingTextSegment
        trailingText={(
          <span className={scheduleStyles.offsetTrailing}>
            <span className={scheduleStyles.spinner}>
              <button
                type="button"
                className={scheduleStyles.spinnerBtn}
                aria-label={`Increment ${label.toLowerCase()}`}
                onClick={() => onValueChange(String((Number(value) || 0) + 1))}
              >
                <Icon name="solar:alt-arrow-up-linear" size={10} color="var(--neutral-300)" />
              </button>
              <button
                type="button"
                className={scheduleStyles.spinnerBtn}
                aria-label={`Decrement ${label.toLowerCase()}`}
                onClick={() => onValueChange(String(Math.max(1, (Number(value) || 0) - 1)))}
              >
                <Icon name="solar:alt-arrow-down-linear" size={10} color="var(--neutral-300)" />
              </button>
            </span>
            <button
              ref={ref}
              type="button"
              className={scheduleStyles.unitTrigger}
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

  const taskPoolRow = (
    <div className={styles.detailRow}>
      <span className={styles.detailLabel}>Task Pool</span>
      <DetailDropdown
        value={pool}
        options={['— Direct assign —', ...(taskPools || []).map(p => p.name)]}
        onSelect={v => setPool(v === '— Direct assign —' ? '' : v)}
      >
        <span style={{ color: pool ? 'var(--neutral-400)' : 'var(--neutral-200)' }}>
          {pool || '— Direct assign —'}
        </span>
      </DetailDropdown>
    </div>
  );

  const labelsRow = (
    <div className={styles.detailRow}>
      <span className={styles.detailLabel}>Labels</span>
      <div className={styles.detailValueLabels}>
        {selectedLabels.map(l => (
          <Badge key={l} variant="overflow" label={l} trailingIcon="solar:close-circle-linear" onClick={() => toggleLabel(l)} />
        ))}
        <CreatableLabelDropdown selectedLabels={selectedLabels} onToggle={toggleLabel} />
      </div>
    </div>
  );

  const descriptionSection = (
    <div className={styles.drawerSection}>
      <span className={styles.drawerSectionLabel}>Description</span>
      <div className={styles.descEditor}>
        <div
          ref={editorRef}
          className={styles.descEditable}
          contentEditable
          suppressContentEditableWarning
          data-placeholder="Add a description..."
          onInput={e => setDescription(e.currentTarget.innerHTML)}
        />
        <div className={styles.descToolbar}>
          <ActionButton icon="solar:paperclip-linear" size="S" tooltip="Attach" />
          <span className={styles.toolbarDivider} />
          <ActionButton icon="solar:text-bold-linear" size="S" tooltip="Bold" onClick={() => document.execCommand('bold')} />
          <ActionButton icon="solar:text-italic-linear" size="S" tooltip="Italic" onClick={() => document.execCommand('italic')} />
          <ActionButton icon="solar:text-underline-linear" size="S" tooltip="Underline" onClick={() => document.execCommand('underline')} />
          <ActionButton icon="solar:text-cross-linear" size="S" tooltip="Strikethrough" onClick={() => document.execCommand('strikeThrough')} />
          <span className={styles.toolbarDivider} />
          <ActionButton icon="solar:list-linear" size="S" tooltip="List" onClick={() => document.execCommand('insertUnorderedList')} />
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={styles.drawerContent}
      style={showScheduleFields ? { gap: 16 } : undefined}
    >
      {!showScheduleFields && (
        <div className={styles.drawerToolbar}>
          <Select
            style={{ width: 120 }}
            options={STATUS_ORDER.map(s => ({ value: s, label: STATUS_LABELS[s] }))}
            value={status}
            onChange={setStatus}
          />
          <div className={styles.drawerToolbarRight}>
            <ActionButton icon="solar:paperclip-linear" size="L" tooltip="Attachments" />
            <span className={styles.iconDivider} />
            <ActionButton icon="solar:link-minimalistic-linear" size="L" tooltip="Copy link" state="disabled" />
            <span className={styles.iconDivider} />
            <ActionButton icon="solar:clipboard-text-linear" size="L" tooltip="Copy ID" state="disabled" />
            <span className={styles.iconDivider} />
            <ActionButton icon="solar:trash-bin-trash-linear" size="L" tooltip="Delete" state="disabled" />
          </div>
        </div>
      )}

      {libraryKind && (
        <InterventionLibrarySelect
          kind={libraryKind}
          onPick={(item) => {
            setName(item.title || '');
            setDescription(item.description || '');
            const p = String(item.config?.priority || '').toLowerCase();
            if (p === 'high' || p === 'medium' || p === 'low') setPriority(p);
          }}
        />
      )}

      <div className={styles.drawerSection}>
        {showScheduleFields ? (
          <div className={scheduleStyles.titleRow}>
            <span className={styles.drawerSectionLabel}>
              Task Title
              <span className={scheduleStyles.mandatoryDotInline} aria-hidden="true" />
            </span>
            <span className={`${styles.charCount} ${name.length > TITLE_MAX ? styles.charCountOver : ''}`}>
              {name.length}/{TITLE_MAX}
            </span>
          </div>
        ) : (
          <span className={styles.drawerSectionLabel}>Task Name</span>
        )}
        {showScheduleFields ? (
          <textarea
            ref={titleTextareaRef}
            aria-label="Task Title"
            className={`${styles.drawerTaskTitleInput} ${scheduleStyles.titleTextarea} ${name.length > TITLE_MAX ? styles.inputInvalid : ''}`}
            placeholder="Enter task title..."
            rows={1}
            value={name}
            onChange={e => setName(e.target.value)}
          />
        ) : (
          <input aria-label="Task Name"
            className={`${styles.drawerTaskTitleInput} ${name.length > TITLE_MAX ? styles.inputInvalid : ''}`}
            style={{ margin: 0, width: '100%' }}
            placeholder="Enter task name..."
            value={name}
            onChange={e => setName(e.target.value)}
          />
        )}
        <div
          className={styles.fieldHelper}
          style={showScheduleFields ? { marginTop: -6 } : undefined}
        >
          <span className={styles.fieldError}>
            {name.length > TITLE_MAX ? `Title must be ${TITLE_MAX} characters or fewer` : ''}
          </span>
          {!showScheduleFields && (
            <span className={`${styles.charCount} ${name.length > TITLE_MAX ? styles.charCountOver : ''}`}>
              {name.length}/{TITLE_MAX}
            </span>
          )}
        </div>
      </div>

      {showScheduleFields && (
        <Textarea
          title="Description"
          richText
          attachment
          placeholder="Add a description..."
          value={description}
          rows={3}
          onChange={(html) => setDescription(html)}
        />
      )}

      <div className={styles.drawerDetails}>
        {!showScheduleFields && taskPoolRow}
        {/* Assigned To — kept visible whether a pool is picked or not.
            When a pool is chosen, useAddTaskDrawer.handleSave nulls the
            direct-assignee at save time; showing the field lets the user
            see (and change) their intent explicitly. */}
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Assigned To</span>
          <DetailDropdown
            value={assignedTo}
            options={assigneeChoices}
            onSelect={setAssignedTo}
            // Only Internal Task lets the user reassign — Patient Task
            // runs on the member and the assignee stays locked to them.
            disabled={!isInternalTask}
            renderOption={opt => {
              const label = typeof opt === 'string' ? opt : opt.label;
              const val = typeof opt === 'string' ? opt : opt.value;
              const initials = (val || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
              // A member (patient) can be the assignee too — match by name
              // against the memberOptions list so their picker row renders
              // with the patient avatar variant, consistent with the Member
              // row and the InterventionDrawer's assignee list.
              const isMember = (memberOptions || []).some(m => (typeof m === 'string' ? m : m.value) === val);
              return (
                <>
                  <Avatar variant={isMember ? 'patient' : 'assignee'} initials={initials} size="S" />
                  <span>{label}</span>
                </>
              );
            }}
          >
            {assignedTo ? (
              <>
                {/* Show the patient avatar when the assignee IS the member;
                    otherwise the staff/assignee treatment. */}
                <Avatar
                  variant={assignedTo && assignedTo === member ? 'patient' : 'assignee'}
                  initials={(assignedTo || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  size="S"
                />
                <span>{currentUserProfile?.name === assignedTo ? `${assignedTo} (You)` : assignedTo}</span>
              </>
            ) : (
              <span style={{ color: 'var(--neutral-200)' }}>Select assignee</span>
            )}
          </DetailDropdown>
        </div>
        {!showScheduleFields && (
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Due Date</span>
            <TaskDatePicker value={dueDate} onSelect={setDueDate} />
          </div>
        )}
        {!showScheduleFields && (
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Priority</span>
            <DetailDropdown
              value={priority}
              options={PRIORITY_OPTIONS}
              onSelect={setPriority}
              renderOption={opt => (
                <><PriorityIcon priority={opt} size={16} /> <span style={{ textTransform: 'capitalize' }}>{opt}</span></>
              )}
            >
              <PriorityIcon priority={priority} size={16} />
              <span style={{ textTransform: 'capitalize' }}>{priority}</span>
            </DetailDropdown>
          </div>
        )}
        {showScheduleFields && (
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Priority</span>
            <DetailDropdown
              value={priority}
              options={PRIORITY_OPTIONS}
              onSelect={setPriority}
              renderOption={opt => (
                <><PriorityIcon priority={opt} size={16} /> <span style={{ textTransform: 'capitalize' }}>{opt}</span></>
              )}
            >
              <PriorityIcon priority={priority} size={16} />
              <span style={{ textTransform: 'capitalize' }}>{priority}</span>
            </DetailDropdown>
          </div>
        )}
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Member</span>
          <DetailDropdown
            value={member}
            options={memberOptions}
            onSelect={setMember}
            renderOption={opt => {
              const val = typeof opt === 'string' ? opt : opt.value;
              const initials = (val || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
              return (
                <>
                  <Avatar variant="patient" initials={initials} size="S" />
                  <span>{val}</span>
                </>
              );
            }}
          >
            {member ? (
              <>
                <Avatar variant="patient" initials={(member || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()} size="S" />
                <span>{member}</span>
              </>
            ) : (
              <span style={{ color: 'var(--neutral-200)' }}>Select member</span>
            )}
          </DetailDropdown>
        </div>
        {!showScheduleFields && labelsRow}

        {/* Care-plan tail — Task Pool and Labels sit ABOVE Creation Date
            per the task-drawer ordering ask. Task Pool is hidden for
            internal tasks (they never route through a pool). */}
        {showScheduleFields && !isInternalTask && taskPoolRow}
        {showScheduleFields && labelsRow}

        {showScheduleFields && (<>
        {/* Creation Date — badge in immediate mode, count+unit input when
            day/week is chosen. Mirrors the intervention drawer. */}
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>
            Creation Date
            <span className={scheduleStyles.mandatoryDotInline} aria-hidden="true" />
          </span>
          <div className={scheduleStyles.inlineRow}>
            {creationTiming === 'immediate' ? (
              <button
                ref={creationTimingRef}
                type="button"
                className={scheduleStyles.badgeTrigger}
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
                wrapperClassName={scheduleStyles.offsetInput}
                trailingTextSegment
                trailingText={(
                  <span className={scheduleStyles.offsetTrailing}>
                    <span className={scheduleStyles.spinner}>
                      <button
                        type="button"
                        className={scheduleStyles.spinnerBtn}
                        aria-label="Increment creation count"
                        onClick={() => setCreationCount(String((Number(creationCount) || 0) + 1))}
                      >
                        <Icon name="solar:alt-arrow-up-linear" size={10} color="var(--neutral-300)" />
                      </button>
                      <button
                        type="button"
                        className={scheduleStyles.spinnerBtn}
                        aria-label="Decrement creation count"
                        onClick={() => setCreationCount(String(Math.max(1, (Number(creationCount) || 0) - 1)))}
                      >
                        <Icon name="solar:alt-arrow-down-linear" size={10} color="var(--neutral-300)" />
                      </button>
                    </span>
                    <button
                      ref={creationTimingRef}
                      type="button"
                      className={scheduleStyles.unitTrigger}
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
            <span className={scheduleStyles.inlineText}>After</span>
            <button
              ref={creationTriggerRef}
              type="button"
              className={scheduleStyles.badgeTrigger}
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

        {/* Due Date offset (X day/week after Task Creation Date). Sits
            below the existing calendar-picker Due Date row so both are
            available. */}
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>
            Due Date
            <span className={scheduleStyles.mandatoryDotInline} aria-hidden="true" />
          </span>
          <div className={scheduleStyles.inlineRow}>
            <Input
              value={dueOffset}
              onChange={e => setDueOffset(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              aria-label="Due date offset"
              wrapperClassName={scheduleStyles.offsetInput}
              trailingTextSegment
              trailingText={(
                <span className={scheduleStyles.offsetTrailing}>
                  <span className={scheduleStyles.spinner}>
                    <button
                      type="button"
                      className={scheduleStyles.spinnerBtn}
                      aria-label="Increment"
                      onClick={() => setDueOffset(String((Number(dueOffset) || 0) + 1))}
                    >
                      <Icon name="solar:alt-arrow-up-linear" size={10} color="var(--neutral-300)" />
                    </button>
                    <button
                      type="button"
                      className={scheduleStyles.spinnerBtn}
                      aria-label="Decrement"
                      onClick={() => setDueOffset(String(Math.max(0, (Number(dueOffset) || 0) - 1)))}
                    >
                      <Icon name="solar:alt-arrow-down-linear" size={10} color="var(--neutral-300)" />
                    </button>
                  </span>
                  <button
                    ref={dueUnitRef}
                    type="button"
                    className={scheduleStyles.unitTrigger}
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
            <span className={scheduleStyles.inlineText}>After Task Creation Date</span>
          </div>
        </div>

        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>
            Duration Type
            <span className={scheduleStyles.mandatoryDotInline} aria-hidden="true" />
          </span>
          <div className={scheduleStyles.radioRow} role="radiogroup" aria-label="Duration Type">
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

        {/* Repeat toggle sits directly under Duration Type; expands into
            [count time] [after N unit] [Ends in N unit] when on. Hidden
            for internal tasks (never recur). */}
        {!isInternalTask && (
        <div className={scheduleStyles.repeatBlock}>
          <Switch checked={repeat} onChange={setRepeat} label="Repeat" size="S" />
          {repeat && (
            <div className={scheduleStyles.repeatRow}>
              <Input
                value={repeatCount}
                onChange={e => setRepeatCount(e.target.value.replace(/\D/g, ''))}
                inputMode="numeric"
                aria-label="Repeat count"
                wrapperClassName={scheduleStyles.offsetInput}
                trailingTextSegment
                trailingText={(
                  <span className={scheduleStyles.offsetTrailing}>
                    <span className={scheduleStyles.spinner}>
                      <button
                        type="button"
                        className={scheduleStyles.spinnerBtn}
                        aria-label="Increment repeat count"
                        onClick={() => setRepeatCount(String((Number(repeatCount) || 0) + 1))}
                      >
                        <Icon name="solar:alt-arrow-up-linear" size={10} color="var(--neutral-300)" />
                      </button>
                      <button
                        type="button"
                        className={scheduleStyles.spinnerBtn}
                        aria-label="Decrement repeat count"
                        onClick={() => setRepeatCount(String(Math.max(1, (Number(repeatCount) || 0) - 1)))}
                      >
                        <Icon name="solar:alt-arrow-down-linear" size={10} color="var(--neutral-300)" />
                      </button>
                    </span>
                    <span className={scheduleStyles.unitStatic}>
                      {Number(repeatCount) === 1 ? 'time' : 'times'}
                    </span>
                  </span>
                )}
              />
              <span className={scheduleStyles.inlineText}>after</span>
              {unitField(
                repeatEvery, setRepeatEvery, repeatEveryUnit, setRepeatEveryUnit,
                repeatEveryUnitOpen, setRepeatEveryUnitOpen, repeatEveryUnitRef, 'Repeat every',
              )}
              <span className={scheduleStyles.inlineText}>Ends in</span>
              {unitField(
                repeatEnds, setRepeatEnds, repeatEndsUnit, setRepeatEndsUnit,
                repeatEndsUnitOpen, setRepeatEndsUnitOpen, repeatEndsUnitRef, 'Ends in',
              )}
            </div>
          )}
        </div>
        )}
        </>)}
      </div>

      {/* Subtasks — same collapsible section + row treatment as Linked
          Goals so both compound sections read consistently. Each row is
          inline-editable (click title, input, blur commits). Hidden for
          internal tasks (only patient tasks carry subtasks). */}
      {showScheduleFields && !isInternalTask && (
        <section className={scheduleStyles.linkedSection}>
          <div className={scheduleStyles.linkedSectionHead}>
            <button
              type="button"
              className={scheduleStyles.linkedSectionToggle}
              onClick={() => setSubtasksOpen(v => !v)}
              aria-expanded={subtasksOpen}
            >
              <span className={scheduleStyles.linkedSectionTitle}>
                Subtasks{stagedSubtasks.length > 0 ? ` (${stagedSubtasks.length})` : ''}
              </span>
              <DownChevronIcon
                size={12}
                color="var(--neutral-400)"
                className={`${scheduleStyles.linkedSectionChevron} ${subtasksOpen ? scheduleStyles.linkedSectionChevronOpen : ''}`}
              />
            </button>
            <ActionButton
              icon="solar:add-linear"
              size="S"
              tooltip="Add subtask"
              onClick={() => { setShowAddSubtask(true); setSubtaskName(''); }}
            />
          </div>
          {subtasksOpen && (
            <ul className={scheduleStyles.linkList}>
              {stagedSubtasks.map((sub, i) => {
                const isEditing = editingSubtaskIdx === i;
                const currentPriority = sub?.priority || 'none';
                const commit = () => {
                  updateStagedSubtask?.(i, { name: editingSubtaskText });
                  setEditingSubtaskIdx(null);
                  setEditingSubtaskText('');
                };
                return (
                  <li key={i} className={scheduleStyles.linkRow}>
                    <span className={scheduleStyles.linkIcon}>
                      <DetailDropdown
                        value={currentPriority}
                        options={['none', ...PRIORITY_OPTIONS]}
                        onSelect={(p) => updateStagedSubtask?.(i, { priority: p })}
                        renderOption={opt => (
                          <><PriorityIcon priority={opt === 'none' ? undefined : opt} size={16} /> <span style={{ textTransform: 'capitalize' }}>{opt}</span></>
                        )}
                      >
                        <PriorityIcon priority={currentPriority === 'none' ? undefined : currentPriority} size={16} />
                      </DetailDropdown>
                    </span>
                    <div className={scheduleStyles.linkStack}>
                      {isEditing ? (
                        <input
                          autoFocus
                          className={scheduleStyles.subtaskEditInput}
                          value={editingSubtaskText}
                          onChange={e => setEditingSubtaskText(e.target.value)}
                          onBlur={commit}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); commit(); }
                            if (e.key === 'Escape') { setEditingSubtaskIdx(null); setEditingSubtaskText(''); }
                          }}
                          maxLength={TITLE_MAX}
                          aria-label="Edit subtask"
                        />
                      ) : (
                        <button
                          type="button"
                          className={scheduleStyles.subtaskEditTrigger}
                          onClick={() => { setEditingSubtaskIdx(i); setEditingSubtaskText(sub?.name || ''); }}
                        >
                          {sub?.name || ''}
                        </button>
                      )}
                    </div>
                    <div className={scheduleStyles.linkActions}>
                      <ActionButton
                        icon="solar:trash-bin-trash-linear"
                        size="S"
                        tooltip="Delete"
                        onClick={() => removeStagedSubtask(i)}
                      />
                    </div>
                  </li>
                );
              })}
              {showAddSubtask ? (
                <li className={scheduleStyles.linkRow}>
                  <span className={scheduleStyles.linkIcon}>
                    <Icon name="custom:subtask" size={16} color="var(--neutral-400)" />
                  </span>
                  <div className={scheduleStyles.linkStack}>
                    <input
                      aria-label="Subtask name"
                      className={scheduleStyles.subtaskEditInput}
                      placeholder="Enter subtask name..."
                      maxLength={TITLE_MAX}
                      value={subtaskName}
                      autoFocus
                      onChange={e => setSubtaskName(e.target.value)}
                      onBlur={() => {
                        if (subtaskName.trim()) addStagedSubtask();
                        else { setShowAddSubtask(false); setSubtaskName(''); }
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); addStagedSubtask(); }
                        if (e.key === 'Escape') { setShowAddSubtask(false); setSubtaskName(''); }
                      }}
                    />
                  </div>
                </li>
              ) : (
                <li className={`${scheduleStyles.linkRow} ${scheduleStyles.subtaskAddRow}`}>
                  <button
                    type="button"
                    className={`${scheduleStyles.linkedEmptyLink} ${scheduleStyles.subtaskAddLink}`}
                    onClick={() => setShowAddSubtask(true)}
                  >
                    <Icon name="custom:subtask" size={14} color="var(--primary-300)" />
                    Add subtask
                  </button>
                </li>
              )}
            </ul>
          )}
        </section>
      )}

      {!showScheduleFields && descriptionSection}

      {!showScheduleFields && (
        <div className={styles.drawerSection}>
          <div className={styles.subtaskHeader}>
            <h4 className={styles.drawerSectionTitle}>
              Subtasks {stagedSubtasks.length > 0 && <span className={styles.subtaskCount}>{stagedSubtasks.length}</span>}
            </h4>
            <button className={styles.subtaskAddBtn} onClick={() => setShowAddSubtask(v => !v)}>
              <Icon name="solar:add-circle-linear" size={14} color="var(--primary-300)" />
              Add Subtask
            </button>
          </div>
          {showAddSubtask && (
            <div className={styles.subtaskAddRow}>
              <input aria-label="Subtask name"
                className={styles.subtaskAddInput}
                placeholder="Enter subtask name..."
                maxLength={TITLE_MAX}
                value={subtaskName}
                onChange={e => setSubtaskName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addStagedSubtask(); if (e.key === 'Escape') { setShowAddSubtask(false); setSubtaskName(''); } }}
                autoFocus
              />
              <Button variant="primary" size="S" onClick={addStagedSubtask} disabled={!subtaskName.trim()}>Add</Button>
              <Button variant="secondary" size="S" onClick={() => { setShowAddSubtask(false); setSubtaskName(''); }}>Cancel</Button>
            </div>
          )}
          {stagedSubtasks.map((sub, i) => (
            <div key={i} className={styles.subtaskCard}>
              <div className={styles.subtaskCardBody}>
                <div className={styles.subtaskCardRow}>
                  <PriorityIcon priority={sub?.priority && sub.priority !== 'none' ? sub.priority : 'medium'} size={16} />
                  <span className={styles.subtaskCardName}>{sub?.name ?? ''}</span>
                </div>
              </div>
              <ActionButton icon="solar:close-circle-linear" size="S" tooltip="Remove" onClick={() => removeStagedSubtask(i)} />
            </div>
          ))}
          {stagedSubtasks.length === 0 && !showAddSubtask && (
            <div className={styles.subtaskEmpty}>No subtasks yet. Break this task down into smaller steps.</div>
          )}
        </div>
      )}

      {/* Linked Goals — collapsible section matching the intervention +
          barrier drawers, so plan-authored tasks carry the same linkage
          affordance. Only rendered when the caller opts into the
          care-plan schedule fields AND supplies goals. */}
      {showScheduleFields && availableGoals.length > 0 && (
        <section className={scheduleStyles.linkedSection}>
          <div className={scheduleStyles.linkedSectionHead}>
            <button
              type="button"
              className={scheduleStyles.linkedSectionToggle}
              onClick={() => setLinkedGoalsOpen(v => !v)}
              aria-expanded={linkedGoalsOpen}
            >
              <span className={scheduleStyles.linkedSectionTitle}>Linked Goals</span>
              <DownChevronIcon
                size={12}
                color="var(--neutral-400)"
                className={`${scheduleStyles.linkedSectionChevron} ${linkedGoalsOpen ? scheduleStyles.linkedSectionChevronOpen : ''}`}
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
              <div className={scheduleStyles.linkedEmptyCard}>
                <span className={scheduleStyles.linkedEmptyIcon}>
                  <Icon name="solar:target-linear" size={16} color="var(--neutral-300)" />
                </span>
                <span className={scheduleStyles.linkedEmptyText}>No Goals linked</span>
                <button
                  type="button"
                  className={scheduleStyles.linkedEmptyLink}
                  onClick={() => setLinkGoalPickerOpen(true)}
                  disabled={goalsForPicker.length === 0}
                >
                  Link Goals
                </button>
              </div>
            ) : (
              <ul className={scheduleStyles.linkList}>
                {linkedGoals.map(g => {
                  const target = formatGoalTarget(g);
                  const duration = formatGoalDuration(g);
                  const subtitle = [target, duration].filter(Boolean).join(' for ');
                  return (
                    <li key={g.id} className={scheduleStyles.linkRow}>
                      <span className={scheduleStyles.linkIcon}>
                        <Icon name={goalIconFor(g)} size={16} color="var(--neutral-400)" />
                      </span>
                      <div className={scheduleStyles.linkStack}>
                        <span className={scheduleStyles.linkTitle}>{g.title}</span>
                        {subtitle && <span className={scheduleStyles.linkSubtitle}>{subtitle}</span>}
                      </div>
                      <div className={scheduleStyles.linkActions}>
                        <ActionButton
                          icon="solar:arrow-right-up-linear"
                          size="S"
                          tooltip="Open goal"
                          onClick={() => onOpenGoal?.(g)}
                        />
                        <span className={scheduleStyles.linkActionsDivider} aria-hidden />
                        <ActionButton
                          icon="solar:link-broken-minimalistic-linear"
                          size="S"
                          tooltip="Unlink"
                          onClick={() => unlinkGoal?.(g.id)}
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
      {showScheduleFields && linkGoalPickerOpen && (
        <LinkGoalToBarrierDrawer
          goals={goalsForPicker}
          title="Link Goal to Task"
          onClose={() => setLinkGoalPickerOpen(false)}
          onLink={(ids) => linkGoal?.(ids)}
        />
      )}
    </div>
  );
}
