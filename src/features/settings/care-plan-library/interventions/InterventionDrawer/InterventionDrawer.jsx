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
import { PriorityIcon } from '../../../../../components/PriorityIcon/PriorityIcon';
import { VITAL_OPTIONS } from '../../lib/vitalOptions';
import { useAppStore } from '../../../../../store/useAppStore';
import { InterventionKindToggle } from '../shared/InterventionKindToggle';
import { KIND_LABELS } from '../shared/interventionKinds';
import styles from '../shared/InterventionDrawer.module.css';

const CREATION_TIMINGS = ['day', 'week', 'immediate'];
const CREATION_TRIGGERS = ['Program Start Date', 'Discharge Date', 'Care Plan Signed'];
const DUE_UNITS = ['day', 'week'];
// Capitalised in the repeat row, per Figma 12211:293048.
const REPEAT_UNITS = ['Days', 'Weeks'];
const PRIORITIES = ['High', 'Medium', 'Low'];
const TITLE_MAX = 150;

const asOptions = (list) => list.map(v => ({ value: v, label: v }));

const isTask = (kind) => kind === 'patient-task' || kind === 'internal-task';

/**
 * One drawer for every intervention kind. The kind decides which entity field
 * sits under the title — a form, an education item, a vital, or a plain
 * description — while title/priority, member task title and the task-date
 * block are common to all. Keeping it as a single component means switching
 * kind swaps the fields in place instead of tearing the drawer down.
 */
export function InterventionDrawer({ onClose, onSave, intervention, kind = 'internal-task', onKindChange, title: titleOverride }) {
  const [title, setTitle] = useState(intervention?.title ?? '');
  const [priority, setPriority] = useState(intervention?.priority ?? 'Medium');
  const [form, setForm] = useState(intervention?.form ?? '');
  const [content, setContent] = useState(intervention?.content ?? '');
  const [vital, setVital] = useState(intervention?.vital ?? '');
  const [note, setNote] = useState(intervention?.note ?? '');
  const [description, setDescription] = useState(intervention?.description ?? '');
  const [memberTaskTitle, setMemberTaskTitle] = useState(intervention?.memberTaskTitle ?? '');
  const [creationTiming, setCreationTiming] = useState(intervention?.creationTiming ?? 'immediate');
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
          memberTaskTitle: memberTaskTitle.trim(),
          creationTiming,
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
        })}
      >
        Save
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
        trailingTextSegment
        trailingText={(
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

  const heading = titleOverride
    || (intervention ? `Edit Intervention - ${KIND_LABELS[kind]}` : KIND_LABELS[kind]);

  return (
    <Drawer title={heading} onClose={onClose} headerRight={headerRight} noCloseDivider>
      <div className={styles.body}>
        <InterventionKindToggle kind={kind} onKindChange={onKindChange} />

        <div className={styles.field}>
          <span className={styles.fieldLabel}>
            Title<span className={styles.mandatoryDot} aria-hidden="true" />
          </span>
          <div className={styles.titleField}>
            <button
              ref={priorityRef}
              type="button"
              className={styles.priorityTrigger}
              aria-label={`Priority: ${priority}`}
              aria-haspopup="menu"
              aria-expanded={priorityOpen}
              onClick={() => setPriorityOpen(v => !v)}
            >
              <PriorityIcon priority={priority.toLowerCase()} size={16} />
              <DownChevronIcon size={10} color="var(--neutral-300)" />
            </button>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Enter The Task Title"
              aria-label="Title"
              maxLength={TITLE_MAX}
              characterLimit={TITLE_MAX}
              className={styles.titleInput}
              wrapperClassName={styles.titleInputWrap}
            />
          </div>
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

        {needsForms && (
          <div className={styles.field}>
            <Select
              label="Forms"
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
          <>
            <div className={styles.field}>
              <Select
                label="Vital"
                required
                options={asOptions(VITAL_OPTIONS)}
                value={vital}
                onChange={setVital}
                placeholder="Search Vital"
                searchable
                searchPlaceholder="Search Vital"
              />
            </div>
            <div className={styles.field}>
              <Input
                label="Note"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Enter the note"
              />
            </div>
          </>
        )}

        {isTask(kind) && (
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Description</span>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What should the task cover?"
              rows={3}
            />
          </div>
        )}

        <div className={styles.field}>
          <Input
            label="Member Task Title"
            value={memberTaskTitle}
            onChange={e => setMemberTaskTitle(e.target.value)}
            placeholder="Enter Task Title"
            maxLength={TITLE_MAX}
            characterLimit={TITLE_MAX}
          />
        </div>

        <div className={styles.dateSection}>
          <span className={styles.sectionTitle}>
            Set Task Dates<span className={styles.mandatoryDot} aria-hidden="true" />
          </span>
          <div className={styles.dateGroup}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Creation Date</span>
              <div className={styles.inlineRow}>
                <Select
                  options={asOptions(CREATION_TIMINGS)}
                  value={creationTiming}
                  onChange={setCreationTiming}
                  className={styles.timingSelect}
                />
                <span className={styles.inlineText}>After</span>
                <Select
                  options={asOptions(CREATION_TRIGGERS)}
                  value={creationTrigger}
                  onChange={setCreationTrigger}
                  className={styles.triggerSelect}
                />
              </div>
            </div>

            <div className={styles.field}>
              <span className={styles.fieldLabel}>Due Date</span>
              <div className={styles.inlineRow}>
                <Input
                  value={dueOffset}
                  onChange={e => setDueOffset(e.target.value.replace(/\D/g, ''))}
                  inputMode="numeric"
                  aria-label="Due date offset"
                  wrapperClassName={styles.offsetInput}
                  trailingTextSegment
                  trailingText={(
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

            <div className={styles.field}>
              <span className={styles.fieldLabel}>Duration Type</span>
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

            {/* Repeat schedule — Figma 12211:293048. */}
            <div className={styles.field}>
              <Switch checked={repeat} onChange={setRepeat} label="Repeat" size="S" />
              {repeat && (
                <div className={styles.repeatRow}>
                  <Input
                    value={repeatCount}
                    onChange={e => setRepeatCount(e.target.value.replace(/\D/g, ''))}
                    inputMode="numeric"
                    aria-label="Repeat count"
                    className={styles.repeatCount}
                  />
                  <span className={styles.inlineText}>time after</span>
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
          </div>
        </div>
      </div>
    </Drawer>
  );
}
