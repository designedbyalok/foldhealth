import { useState, useEffect, useMemo, useRef } from 'react';
import { Drawer } from '../../../../../../../../components/Drawer/Drawer';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { Badge } from '../../../../../../../../components/Badge/Badge';
import { Button } from '../../../../../../../../components/Button/Button';
import { Select } from '../../../../../../../../components/Select/Select';
import { Input } from '../../../../../../../../components/Input/Input';
import { Textarea } from '../../../../../../../../components/Textarea/Textarea';
import { Avatar } from '../../../../../../../../components/Avatar/Avatar';
import { ActionButton } from '../../../../../../../../components/ActionButton/ActionButton';
import { Slider } from '../../../../../../../../components/ShadcnSlider/ShadcnSlider';
import { PriorityIcon } from '../../../../../../../../components/PriorityIcon/PriorityIcon';
import { CarePlanActivityBlock } from '../CarePlanActivityBlock/CarePlanActivityBlock';
import { MenuPopover } from '../../../../../../../../components/MenuPopover/MenuPopover';
import { ConfirmDialog } from '../../../../../../../../components/ConfirmDialog/ConfirmDialog';
import { DownChevronIcon } from '../../../../../../../../components/Icon/DownChevronIcon';
import { LinkGoalToBarrierDrawer } from '../BarrierDetailDrawer/LinkGoalToBarrierDrawer';
import { DetailDropdown } from '../../../../../../../tasks/TasksViewDropdowns';
import { PRIORITY_OPTIONS } from '../../../../../../../tasks/TasksView.utils';
import { GbiProgressCell } from '../../tables/carePlanTableShared';
import { computeDueDate, computeOccurrenceDates, formatRecurrenceLabel } from '../../tables/CarePlanInterventionsTable';
import { useScrollToSection } from '../../lib/useScrollToSection';
import { CARE_PLAN_INTERVENTION_ICONS, interventionDurationFromConfig } from '../../lib/carePlanInterventionMenu';
import { KIND_LABELS } from '../../../../../../../settings/care-plan-library/interventions/shared/interventionKinds';
import { useAppStore } from '../../../../../../../../store/useAppStore';
import { adherenceBand, adherenceTone } from '../../lib/goalMetrics';
import styles from '../GoalPreviewDrawer/GoalPreviewDrawer.module.css';
import barrierStyles from '../BarrierDetailDrawer/BarrierDetailDrawer.module.css';

const GBI_STATUSES = ['Not Started', 'In Progress', 'On Hold', 'Met', 'Not Met'];
const STATUS_TONE = {
  'Not Started': 'grey',
  'In Progress': 'warning',
  'On Hold': 'grey',
  Met: 'success',
  'Not Met': 'error',
};

function adherenceNum(value) {
  const n = Number(value);
  return Number.isFinite(n) && value !== '-' ? n : 0;
}

// Adherence uses the 3-band scheme (Poor / Moderate / Good) from the
// shared lib — intervention adherence is a distinct metric from goal
// progress, which stays on 5 bands. Local aliases keep the render calls
// short without re-declaring the logic.
const progressBand = adherenceBand;
const progressTone = adherenceTone;

// Progress slider fill / thumb color per band. Fed into the slider via
// the `--slider-tone` CSS variable so the CSS module can flip the fill
// and border colors without changing markup. Figma 2632:110774.
function progressSliderColor(pct) {
  const tone = progressTone(progressBand(pct));
  if (tone === 'error') return 'var(--status-error)';
  if (tone === 'warning') return 'var(--status-warning)';
  if (tone === 'success') return 'var(--status-success)';
  return 'var(--neutral-300)';
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
}

function fmtStamp(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${date} ${time}`;
}

const initialsOf = (name) => (name || '').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

function splitArrow(detail) {
  if (!detail || !detail.includes('→')) return [null, null];
  const [from, to] = detail.split('→').map(s => s.trim());
  return [from || null, to || null];
}

function mapAuditEntry(e) {
  const [from, to] = splitArrow(e.detail);
  const created = e.createdAt ? new Date(e.createdAt) : null;
  const date = created ? created.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;
  const time = created ? created.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null;
  const base = {
    id: e.id,
    actor: e.actor || '',
    at: e.createdAt,
    createdAt: e.createdAt,
    action: e.action,
    date,
    time,
    by: e.actor || null,
  };
  if (e.action === 'note') {
    return {
      ...base,
      t: 'comment',
      title: 'Added a Note',
      commentBody: `Note: ${e.detail || ''}`,
      comment: e.detail,
      verb: 'added a',
      field: 'Note',
    };
  }
  if (e.action === 'note_deleted') {
    return {
      ...base,
      t: 'comment',
      title: 'Deleted a Note',
      commentBody: e.detail ? `Note: ${e.detail}` : '',
      comment: e.detail,
      verb: 'deleted a',
      field: 'Note',
    };
  }
  if (e.action === 'created') {
    return { ...base, t: 'default', title: 'added an Intervention', verb: 'added an', field: 'Intervention' };
  }
  if (e.action === 'deleted') {
    return { ...base, t: 'default', title: 'removed an Intervention', verb: 'removed an', field: 'Intervention' };
  }
  if (e.action === 'goal_linked') {
    return {
      ...base,
      t: 'comment',
      title: 'Linked Goal',
      commentBody: e.detail ? `Goal: ${e.detail}` : '',
      comment: e.detail,
      verb: 'linked a',
      field: 'Goal',
    };
  }
  if (e.action === 'goal_unlinked') {
    return {
      ...base,
      t: 'comment',
      title: 'Unlinked Goal',
      commentBody: e.detail ? `Goal: ${e.detail}` : '',
      comment: e.detail,
      verb: 'unlinked a',
      field: 'Goal',
    };
  }
  if (e.action === 'status_changed') {
    return { ...base, t: 'status_change', title: 'Status', from, to, verb: 'changed the', field: 'Status', fromTone: STATUS_TONE[from] || 'grey', toTone: STATUS_TONE[to] || 'grey' };
  }
  if (e.action === 'progress_changed') {
    return { ...base, t: 'status_change', title: 'Adherence', from, to, verb: 'changed the', field: 'Adherence', fromTone: progressTone(from), toTone: progressTone(to) };
  }
  return { ...base, t: 'default', title: e.summary || 'updated', verb: 'updated', field: e.summary || 'Intervention' };
}

function AccordionHead({ title, open, onToggle, onAdd, addTooltip, canEdit }) {
  return (
    <div className={styles.accHead}>
      <button type="button" className={styles.accToggle} onClick={onToggle} aria-expanded={open}>
        <span className={`${styles.accChevron} ${open ? styles.accChevronOpen : ''}`}>
          <DownChevronIcon size={12} color="var(--neutral-300)" />
        </span>
        <span className={styles.accTitle}>{title}</span>
      </button>
      {canEdit && onAdd && (
        <ActionButton icon="solar:add-linear" size="S" tooltip={addTooltip} onClick={onAdd} />
      )}
    </div>
  );
}

/**
 * Intervention details — Paper 35-0. Mirrors Goal Details layout with
 * adherence, linked goals, automations, notes, and activity feed.
 */
export function InterventionPreviewDrawer({ intervention, patientId, program, onClose, onEdit, onOpenGoal, consolidated = false, focusSection = null }) {
  const key = patientId && program ? `${patientId}::${program.id}` : null;
  const slice = useAppStore(s => (key ? s.patientCarePlans[key] : null));
  const audit = useAppStore(s => (key ? s.patientCarePlanAudit[key] : null)) || [];
  const lastVisit = useAppStore(s => {
    const p = (s.patients || []).find(x => x.id === patientId)
      || (s.allPatients || []).find(x => x.id === patientId);
    return p?.lastVisit || p?.last_visit || null;
  });
  const savePatientCarePlanIntervention = useAppStore(s => s.savePatientCarePlanIntervention);
  const deletePatientCarePlanIntervention = useAppStore(s => s.deletePatientCarePlanIntervention);
  const saveCarePlanAutomation = useAppStore(s => s.saveCarePlanAutomation);
  const deleteCarePlanAutomation = useAppStore(s => s.deleteCarePlanAutomation);
  const addCarePlanNote = useAppStore(s => s.addCarePlanNote);
  const updateCarePlanNote = useAppStore(s => s.updateCarePlanNote);
  const deleteCarePlanNote = useAppStore(s => s.deleteCarePlanNote);
  const logCarePlanAudit = useAppStore(s => s.logCarePlanAudit);
  const fetchCarePlanAudit = useAppStore(s => s.fetchCarePlanAudit);
  const currentUserName = useAppStore(s => s.currentUserProfile?.name);
  // Content lookup — a Patient Education intervention stores the linked
  // material id as `config.content` (prefixed `email:<id>` / `form:<id>`);
  // Send Form stores it as `config.form`. Resolve to a name so the
  // reader can see which content was shared without opening the editor.
  const contentEmails = useAppStore(s => s.contentEmails);
  const contentForms = useAppStore(s => s.contentForms);
  const fetchContentEmails = useAppStore(s => s.fetchContentEmails);
  const fetchContentForms = useAppStore(s => s.fetchContentForms);

  const live = (slice?.interventions || []).find(i => i.id === intervention?.id) || intervention;
  const linkedGoals = useMemo(
    () => (slice?.goals || []).filter(g => g.id === live?.goalId),
    [slice, live],
  );
  // Read the paired task once so the hero can show a real "Due Date" and
  // the recurrence marker on the duration chip. Falls back to the intervention
  // config when the task hasn't been paired yet (pre-migration rows).
  const pairedTask = useAppStore(s => {
    if (!live?.taskId) return null;
    return (s.tasks || []).find(t => String(t.id) === String(live.taskId)) || null;
  });
  const automations = useMemo(
    () => (slice?.automations || []).filter(a => !live?.goalId || a.goalId === live.goalId),
    [slice, live],
  );

  const [pct, setPct] = useState(() => adherenceNum(live?.adherence));
  const [pctDragging, setPctDragging] = useState(false);
  const [open, setOpen] = useState({ tasks: true, goals: true, automations: true });
  const [addingAutomation, setAddingAutomation] = useState(false);
  const [automationTitle, setAutomationTitle] = useState('');
  const [note, setNote] = useState('');
  const [noteEditing, setNoteEditing] = useState(false);
  const [moreMenu, setMoreMenu] = useState(null);
  const [linkGoalOpen, setLinkGoalOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [confirm, setConfirm] = useState(null);
  const moreBtnRef = useRef(null);

  useEffect(() => { setPct(adherenceNum(live?.adherence)); }, [live?.id, live?.adherence]);
  useEffect(() => { if (patientId && program) fetchCarePlanAudit(patientId, program.id); }, [patientId, program, fetchCarePlanAudit]);

  // Lazy-load the content library only for the kinds that need it — so the
  // Linked Education / Linked Form row can render a name instead of the raw
  // id when the drawer is opened cold (e.g. no library visit yet this
  // session).
  useEffect(() => {
    if (live?.kind === 'patient-education') {
      fetchContentEmails?.({ page: 1, perPage: 50, search: '' });
      fetchContentForms?.({ page: 1, perPage: 50, search: '' });
    } else if (live?.kind === 'send-form') {
      fetchContentForms?.({ page: 1, perPage: 50, search: '' });
    }
  }, [live?.kind, fetchContentEmails, fetchContentForms]);

  // Resolve the linked content chip: shape `{ kind: 'Email'|'Form', label, id, missing? }`
  // for the row renderer. `missing: true` marks a saved id that no longer
  // exists in the library (or hasn't been loaded yet) so the row can still
  // surface the raw handle.
  const linkedContent = useMemo(() => {
    if (!live) return null;
    if (live.kind === 'patient-education') {
      const raw = live.config?.content || '';
      if (!raw) return null;
      if (raw.startsWith('email:')) {
        const id = raw.slice('email:'.length);
        const hit = (contentEmails || []).find(e => String(e.id) === String(id));
        return { kind: 'Email', label: hit?.name || `Email #${id}`, id, missing: !hit };
      }
      if (raw.startsWith('form:')) {
        const id = raw.slice('form:'.length);
        const hit = (contentForms || []).find(f => String(f.id) === String(id));
        return { kind: 'Form', label: hit?.name || `Form #${id}`, id, missing: !hit };
      }
      return { kind: 'Content', label: raw, id: raw, missing: true };
    }
    if (live.kind === 'send-form') {
      const raw = live.config?.form || '';
      if (!raw) return null;
      const hit = (contentForms || []).find(f => String(f.id) === String(raw));
      return { kind: 'Form', label: hit?.name || `Form #${raw}`, id: raw, missing: !hit };
    }
    return null;
  }, [live, contentEmails, contentForms]);
  const linkedContentTitle = live?.kind === 'send-form' ? 'Linked Form' : 'Linked Education';

  // Latest saved note on this intervention — seeds the note editor and
  // drives the "Update Note" vs "Add Note" label. A subsequent
  // `note_deleted` entry on the same intervention hides the note card
  // (but the delete + original add still appear in the Activity Log).
  const latestInterventionNote = useMemo(() => {
    const forThis = audit.filter(a => String(a.entityId) === String(live?.id));
    const notes = forThis
      .filter(a => a.action === 'note' && (a.entityType === 'intervention' || a.entityType === 'note'))
      .sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt));
    const latestNote = notes[0];
    if (!latestNote) return null;
    const latestClear = forThis
      .filter(a => a.action === 'note_deleted')
      .sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt))[0];
    if (latestClear && new Date(latestClear.createdAt) >= new Date(latestNote.createdAt)) return null;
    return latestNote;
  }, [audit, live?.id]);

  // Seed the note textarea from the latest saved note whenever it changes
  // (drawer opens on a new intervention OR a new note was just saved). Exit
  // edit mode after a fresh save so the read-only display re-appears.
  useEffect(() => {
    const seed = latestInterventionNote?.detail || '';
    setNote(seed);
    setNoteEditing(false);
  }, [latestInterventionNote?.id]);

  const activity = useMemo(() => audit
    .filter(a => String(a.entityId) === String(live?.id))
    .map(mapAuditEntry), [audit, live]);
  const noteSectionRef = useRef(null);
  useScrollToSection(noteSectionRef, focusSection === 'notes', live?.id);

  if (!live) return null;

  const canEdit = !!(patientId && program);
  const youSuffix = (name) => (name && currentUserName && name === currentUserName ? ` by ${name} (You)` : name ? ` by ${name}` : '');
  const toggle = (k) => setOpen(s => ({ ...s, [k]: !s[k] }));
  const expandAnd = (k, fn) => { setOpen(s => ({ ...s, [k]: true })); fn(); };

  const commitAdherence = (v) => {
    const next = v[0];
    if (next === adherenceNum(live.adherence)) return;
    savePatientCarePlanIntervention(patientId, program, { ...live, adherence: String(next) }, live.id);
  };

  const changeStatus = (status) => {
    if (!canEdit || status === live.status) return;
    savePatientCarePlanIntervention(patientId, program, { ...live, status }, live.id);
  };

  const commitTitle = () => {
    const next = titleDraft.trim();
    setEditingTitle(false);
    if (!next || next === live.title) return;
    savePatientCarePlanIntervention(patientId, program, { ...live, title: next }, live.id);
  };

  const submitAutomation = async () => {
    if (!automationTitle.trim() || !live.goalId) return;
    await saveCarePlanAutomation(patientId, program, live.goalId, { title: automationTitle.trim() });
    setAutomationTitle('');
    setAddingAutomation(false);
  };

  const submitNote = async () => {
    const body = note.replace(/<[^>]+>/g, '').trim();
    if (!body) return;
    await addCarePlanNote(patientId, program, body, { entityType: 'intervention', entityId: live.id, summary: `Note on ${live.title}` });
    setNoteEditing(false);
  };

  // Prefer the paired task's due date (kinds that spawn a Task); fall
  // back to an explicit `config.dueDate`; finally derive from
  // `config.dueOffset` + `config.dueUnit` relative to `createdAt` so
  // library-form kinds (patient-education, send-form) that only carry
  // an offset still surface a Due Date.
  const derivedDueFromConfig = (() => {
    const off = Number(live?.config?.dueOffset);
    if (!Number.isFinite(off) || off <= 0) return null;
    const start = live?.createdAt ? new Date(live.createdAt) : null;
    if (!start || Number.isNaN(start.getTime())) return null;
    const unit = String(live?.config?.dueUnit || '').toLowerCase();
    const d = new Date(start);
    if (unit.startsWith('week')) d.setDate(d.getDate() + off * 7);
    else if (unit.startsWith('month')) d.setMonth(d.getMonth() + off);
    else d.setDate(d.getDate() + off);
    return d.toISOString();
  })();
  const dueDate = pairedTask?.dueDate || pairedTask?.due_date
    || live.config?.dueDate || derivedDueFromConfig || null;
  const hasRepeat = !!(pairedTask?.repeat || live.config?.repeat);

  // Prefer the same computeDueDate helper the plan table + inline
  // date picker use so this line, the picker, and the Day Wise Task
  // Progress rows all read the same date. Falls back to the legacy
  // paired-task / config paths for older records that only carry
  // those fields.
  const computedDueIso = computeDueDate(live).iso;
  const displayDueIso = computedDueIso
    || (dueDate ? (typeof dueDate === 'string' ? dueDate : null) : null);
  const durationLabel = interventionDurationFromConfig(live.config);
  const recurringLabel = hasRepeat ? formatRecurrenceLabel(live) : null;

  // Primary line: everything the reviewer needs at a glance about
  // scheduling — start, due, duration, recurrence. Audit line
  // (Last Update) drops to its own row so the primary line stays
  // scannable at any width.
  const metaParts = [
    live.createdAt ? `Start Date : ${fmtDate(live.createdAt)}` : null,
    displayDueIso ? `Due Date : ${fmtDate(displayDueIso)}` : null,
    durationLabel ? `Duration : ${durationLabel}` : null,
    recurringLabel ? recurringLabel : null,
  ].filter(Boolean);
  const lastUpdateLabel = live.updatedAt
    ? `Last Update : ${fmtDate(live.updatedAt)}${youSuffix(live.updatedBy)}`
    : null;

  return (
    <Drawer
      title={KIND_LABELS[live.kind] ? `Intervention - ${KIND_LABELS[live.kind]}` : 'Intervention'}
      onClose={onClose}
      bodyClassName={styles.drawerPad}
    >
      <div className={styles.body}>
        <div className={styles.statusBar}>
          <Select
            options={GBI_STATUSES.map(s => ({ value: s, label: s }))}
            value={live.status}
            onChange={changeStatus}
            disabled={!canEdit}
            portal
            className={styles.statusSelect}
            style={{ width: 'fit-content' }}
          />
          <div className={styles.statusActions}>
            {!consolidated && (
              <>
                <ActionButton
                  icon="solar:pen-linear"
                  size="L"
                  tooltip="Edit Intervention"
                  disabled={!canEdit}
                  onClick={() => {
                    // Prefer the full edit drawer when the caller wires one
                    // (opens the kind-specific InterventionDrawer with every
                    // field). Fall back to inline title-edit otherwise.
                    if (onEdit) onEdit(live);
                    else { setTitleDraft(live.title); setEditingTitle(true); }
                  }}
                />
                <span className={styles.headerDivider} />
                <ActionButton
                  ref={moreBtnRef}
                  icon="solar:menu-dots-linear"
                  size="L"
                  tooltip="More"
                  disabled={!canEdit}
                  onClick={(e) => setMoreMenu(e.currentTarget.getBoundingClientRect())}
                />
              </>
            )}
          </div>
        </div>

        <div className={`${styles.hero} ${styles.heroWithKind}`}>
          <div className={styles.titleRow}>
            <span className={styles.priorityTrigger} aria-hidden="false">
              <DetailDropdown
                value={live.priority}
                options={PRIORITY_OPTIONS}
                onSelect={(v) => {
                  if (!canEdit || v === live.priority) return;
                  savePatientCarePlanIntervention(patientId, program, { ...live, priority: v }, live.id);
                }}
                searchable={false}
                renderOption={(opt) => (
                  <>
                    <PriorityIcon priority={opt} size={16} />
                    <span style={{ textTransform: 'capitalize' }}>{opt}</span>
                  </>
                )}
              >
                <PriorityIcon priority={live.priority} size={20} />
              </DetailDropdown>
            </span>
            {editingTitle ? (
              <input
                autoFocus
                type="text"
                className={styles.titleInlineInput}
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={e => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                aria-label="Intervention title"
              />
            ) : (
              <button
                type="button"
                className={styles.titleEditable}
                onClick={() => {
                  if (!canEdit) return;
                  setTitleDraft(live.title || '');
                  setEditingTitle(true);
                }}
                disabled={!canEdit}
                aria-label="Edit intervention title"
              >
                {live.title}
              </button>
            )}
          </div>
          {metaParts.length > 0 && <span className={styles.meta}>{metaParts.join(' • ')}</span>}
          {lastUpdateLabel && <span className={styles.meta}>{lastUpdateLabel}</span>}
          {(linkedContent || live.duration) && (
            <div className={styles.heroBadgeRow}>
              {linkedContent && (
                <button
                  type="button"
                  className={styles.linkedContentBadge}
                  onClick={() => { if (canEdit) onEdit?.(live); }}
                  disabled={!canEdit}
                  aria-label={`Open ${linkedContentTitle.toLowerCase()}`}
                >
                  <Icon
                    name={linkedContent.kind === 'Form' ? 'solar:document-text-linear' : 'solar:letter-linear'}
                    size={14}
                    color="var(--neutral-400)"
                  />
                  <span>{linkedContent.label}</span>
                  <Icon name="solar:arrow-right-up-linear" size={12} color="var(--neutral-400)" />
                </button>
              )}
              {live.duration && (
                <Badge
                  tone="grey"
                  size="S"
                  icon="solar:clock-circle-linear"
                  label={live.duration}
                  trailingIcon={hasRepeat ? 'solar:refresh-linear' : undefined}
                />
              )}
            </div>
          )}
        </div>

        <section className={styles.section}>
          <span className={styles.progressLabel}>Adherence</span>
          <div className={styles.progressCard} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div
              className={styles.progressWrap}
              style={{ '--slider-tone': progressSliderColor(pct), flex: 1, minWidth: 0 }}
            >
              {pctDragging && (
                <div className={styles.progressBubble} style={{ left: `${pct}%` }}>
                  {pct}% • {progressBand(pct)}
                </div>
              )}
              <Slider
                className={styles.progressSlider}
                value={[pct]}
                min={0}
                max={100}
                step={1}
                disabled={!canEdit}
                onPointerDown={() => setPctDragging(true)}
                onPointerUp={() => setPctDragging(false)}
                onPointerCancel={() => setPctDragging(false)}
                onValueChange={v => setPct(v[0])}
                onValueCommit={(v) => { commitAdherence(v); setPctDragging(false); }}
                aria-label="Intervention adherence"
              />
            </div>
            <Badge
              size="S"
              tone={progressTone(progressBand(pct))}
              label={`${pct}% • ${progressBand(pct)}`}
            />
          </div>
        </section>

        {(() => {
          // Day Wise Task Progress — every recurring intervention fans
          // out into a series of dated task rows. Uses the same
          // occurrence math as the plan-table due-date picker so this
          // list stays in lockstep with the highlighted dates the user
          // saw when scheduling the intervention. Non-recurring
          // interventions still render one row (the due date itself).
          const occurrenceIsos = live?.config?.repeat
            ? computeOccurrenceDates(live)
            : (computeDueDate(live).iso ? [computeDueDate(live).iso] : []);
          if (!occurrenceIsos.length) return null;
          const todayIso = (() => {
            const d = new Date();
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          })();
          // Row status is derived, not per-instance persisted: the
          // intervention only carries one overall status today. Past
          // dates read as "Completed" once the parent intervention is
          // Completed, otherwise every row shows "Pending". This keeps
          // the view honest without inventing per-day state.
          const overallStatus = live?.status || 'Not Started';
          const parentDone = ['Completed', 'Met'].includes(overallStatus);
          const rowsForRow = occurrenceIsos.map(iso => {
            const isPast = iso < todayIso;
            const status = parentDone
              ? 'Completed'
              : (isPast ? 'Completed' : 'Pending');
            return { iso, status };
          });
          const kindIcon = CARE_PLAN_INTERVENTION_ICONS[live?.kind] || live?.icon || 'solar:clipboard-list-linear';
          const fmtRow = (iso) => {
            const d = new Date(iso);
            if (Number.isNaN(d.getTime())) return iso;
            return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
          };
          return (
            <section className={barrierStyles.section}>
              <div className={barrierStyles.sectionHead}>
                <button
                  type="button"
                  className={barrierStyles.sectionToggle}
                  onClick={() => toggle('tasks')}
                  aria-expanded={open.tasks}
                >
                  <span className={barrierStyles.sectionTitle}>Day Wise Task Progress</span>
                  <DownChevronIcon
                    size={12}
                    color="var(--neutral-400)"
                    className={`${barrierStyles.sectionChevron} ${open.tasks ? barrierStyles.sectionChevronOpen : ''}`}
                  />
                </button>
              </div>
              {open.tasks && (
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 'var(--font-base)',
                    color: 'var(--neutral-500)',
                  }}
                >
                  <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--neutral-300)' }}>
                      <th style={{ width: 32, padding: 'var(--space-2) 0', fontWeight: 400 }}>P</th>
                      <th style={{ padding: 'var(--space-2) 0', fontWeight: 400 }}>Name</th>
                      <th style={{ width: 140, padding: 'var(--space-2) 0', fontWeight: 400 }}>Status</th>
                      <th style={{ width: 120, padding: 'var(--space-2) 0', fontWeight: 400 }}>Due Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rowsForRow.map(({ iso, status }) => (
                      <tr key={iso} style={{ borderTop: '0.5px solid var(--neutral-150)' }}>
                        <td style={{ padding: 'var(--space-2) 0' }}>
                          <PriorityIcon priority={live?.priority} size={16} />
                        </td>
                        <td style={{ padding: 'var(--space-2) 0' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <Icon name={kindIcon} size={16} color="var(--neutral-400)" />
                            {live?.title}
                          </span>
                        </td>
                        <td style={{ padding: 'var(--space-2) 0' }}>
                          <Badge
                            size="S"
                            tone={status === 'Completed' ? 'success' : 'grey'}
                            label={status}
                          />
                        </td>
                        <td style={{ padding: 'var(--space-2) 0', color: 'var(--neutral-300)' }}>{fmtRow(iso)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          );
        })()}

        {/* Linked Goals section — hidden entirely in the Comprehensive
            Care Plan view when nothing is linked (user can't link new
            goals here); otherwise shown read-only (Link/Unlink hidden). */}
        {(!consolidated || linkedGoals.length > 0) && (
        <section className={barrierStyles.section}>
          <div className={barrierStyles.sectionHead}>
            <button
              type="button"
              className={barrierStyles.sectionToggle}
              onClick={() => toggle('goals')}
              aria-expanded={open.goals}
            >
              <span className={barrierStyles.sectionTitle}>Linked Goals</span>
              <DownChevronIcon
                size={12}
                color="var(--neutral-400)"
                className={`${barrierStyles.sectionChevron} ${open.goals ? barrierStyles.sectionChevronOpen : ''}`}
              />
            </button>
            {canEdit && !consolidated && (
              <ActionButton
                icon="solar:add-linear"
                size="S"
                tooltip="Link goal"
                onClick={() => setLinkGoalOpen(true)}
              />
            )}
          </div>
          {open.goals && (
            linkedGoals.length === 0 ? (
              <div className={barrierStyles.empty}>Not linked to any goals in this plan version yet.</div>
            ) : (
              <ul className={barrierStyles.linkList}>
                {linkedGoals.map(g => (
                  <li key={g.id} className={barrierStyles.linkRow}>
                    <span className={barrierStyles.linkIcon}>
                      <Icon name={g.icon || 'solar:flag-linear'} size={16} color="var(--neutral-400)" />
                    </span>
                    <div className={barrierStyles.linkStack}>
                      <span className={barrierStyles.linkTitle}>{g.title}</span>
                      {g.subtitle && <span className={barrierStyles.linkSubtitle}>{g.subtitle}</span>}
                    </div>
                    <div className={barrierStyles.linkActions} style={{ gap: 'var(--space-2)' }}>
                      <PriorityIcon priority={g.priority} size={16} />
                      <span className={barrierStyles.linkActionsDivider} aria-hidden style={{ margin: 0 }} />
                      <GbiProgressCell progress={g.progress} />
                      <span className={barrierStyles.linkActionsDivider} aria-hidden style={{ margin: 0 }} />
                      <ActionButton
                        icon="solar:arrow-right-up-linear"
                        size="S"
                        tooltip="Open goal"
                        onClick={() => onOpenGoal?.(g)}
                      />
                      {canEdit && !consolidated && (
                        <>
                          <span className={barrierStyles.linkActionsDivider} aria-hidden style={{ margin: 0 }} />
                          <ActionButton
                            icon="solar:link-broken-minimalistic-linear"
                            size="S"
                            tooltip="Unlink"
                            onClick={() => savePatientCarePlanIntervention(patientId, program, { ...live, goalId: null }, live.id)}
                          />
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )
          )}
        </section>
        )}

        {/* Automations section — hidden entirely in the Comprehensive
            Care Plan view when nothing is set up (user can't add new
            automations from that surface); otherwise shown read-only. */}
        {(!consolidated || automations.length > 0) && (
        <section className={barrierStyles.section}>
          <div className={barrierStyles.sectionHead}>
            <button
              type="button"
              className={barrierStyles.sectionToggle}
              onClick={() => toggle('automations')}
              aria-expanded={open.automations}
            >
              <span className={barrierStyles.sectionTitle}>Automations</span>
              <DownChevronIcon
                size={12}
                color="var(--neutral-400)"
                className={`${barrierStyles.sectionChevron} ${open.automations ? barrierStyles.sectionChevronOpen : ''}`}
              />
            </button>
            {canEdit && !!live.goalId && !consolidated && (
              <ActionButton
                icon="solar:add-linear"
                size="S"
                tooltip="Add automation"
                onClick={() => expandAnd('automations', () => setAddingAutomation(v => !v))}
              />
            )}
          </div>
          {open.automations && (
            <>
              {addingAutomation && (
                <div className={styles.addRow}>
                  <Input
                    placeholder="Automation (e.g. Notify care team on missed task)"
                    value={automationTitle}
                    onChange={e => setAutomationTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') submitAutomation(); }}
                    aria-label="Automation title"
                  />
                  <Button variant="primary" size="S" onClick={submitAutomation} disabled={!automationTitle.trim()}>Save</Button>
                </div>
              )}
              {automations.length === 0 ? (
                <div className={barrierStyles.empty}>No automations set up yet.</div>
              ) : (
                <ul className={barrierStyles.linkList}>
                  {automations.map(a => (
                    <li key={a.id} className={barrierStyles.linkRow}>
                      <span className={barrierStyles.linkIcon}>
                        <Icon name={a.icon || 'solar:bolt-linear'} size={16} color="var(--neutral-400)" />
                      </span>
                      <div className={barrierStyles.linkStack}>
                        <span className={barrierStyles.linkTitle}>{a.title}</span>
                      </div>
                      {canEdit && (
                        <div className={barrierStyles.linkActions}>
                          <ActionButton
                            icon="solar:link-broken-minimalistic-linear"
                            size="S"
                            tooltip="Remove automation"
                            onClick={() => deleteCarePlanAutomation(patientId, program.id, a.id)}
                          />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
        )}

        {canEdit && (
          <div ref={noteSectionRef} className={barrierStyles.noteEditor}>
            {latestInterventionNote && !noteEditing ? (
              <section className={barrierStyles.section}>
                <div className={barrierStyles.sectionHead}>
                  <span className={barrierStyles.sectionTitle}>Note</span>
                </div>
                <div className={styles.careNoteCardWrap}>
                  <button
                    type="button"
                    className={styles.careNoteCard}
                    onClick={() => setNoteEditing(true)}
                    aria-label="Edit note"
                  >
                    <p className={styles.careNoteBody}>{latestInterventionNote.detail}</p>
                    <div className={styles.careNoteMeta}>
                      <span className={styles.careNoteAuthor}>{latestInterventionNote.actor || 'You'}</span>
                      <span className={styles.careNoteDot} aria-hidden="true">•</span>
                      <span className={styles.careNoteTimestamp}>{fmtStamp(latestInterventionNote.createdAt)}</span>
                    </div>
                  </button>
                  <span className={styles.careNoteDelete}>
                    <ActionButton
                      icon="solar:trash-bin-trash-linear"
                      size="S"
                      tooltip="Delete note"
                      onClick={() => {
                        // Log a new "Deleted a Note" audit entry — the
                        // original "Added a Note" row stays in place so
                        // both events remain visible in the Activity Log.
                        logCarePlanAudit?.(patientId, program, {
                          entityType: 'intervention',
                          entityId: live.id,
                          action: 'note_deleted',
                          summary: `Note on ${live.title || 'intervention'} deleted`,
                          detail: latestInterventionNote.detail || '',
                        });
                        // Drop the seeded text so the editor reopens empty.
                        setNote('');
                        setNoteEditing(true);
                      }}
                    />
                  </span>
                </div>
              </section>
            ) : (
              <>
                <section className={barrierStyles.section}>
                  <div className={barrierStyles.sectionHead}>
                    <span className={barrierStyles.sectionTitle}>Note</span>
                  </div>
                  <Textarea
                    placeholder="Add a note"
                    value={note}
                    onChange={(value) => {
                      const v = typeof value === 'string' ? value : '';
                      setNote(v);
                    }}
                    rows={3}
                  />
                </section>
                {(() => {
                  const baseline = (latestInterventionNote?.detail || '').trim();
                  const current = note.trim();
                  const canSave = current.length > 0 && current !== baseline;
                  const canDiscard = current !== baseline || noteEditing;
                  return (
                    <div className={barrierStyles.noteActions}>
                      <Button
                        variant="secondary"
                        size="M"
                        disabled={!canDiscard}
                        onClick={() => {
                          setNote(baseline);
                          if (latestInterventionNote) setNoteEditing(false);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        size="M"
                        disabled={!canSave}
                        onClick={submitNote}
                      >
                        {latestInterventionNote ? 'Update Note' : 'Add Note'}
                      </Button>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}
      </div>

      <CarePlanActivityBlock
        entries={activity}
        lastVisit={lastVisit}
        emptyLabel="No activity for this intervention yet."
      />

      {moreMenu && (
        <MenuPopover
          anchorRect={moreMenu}
          width={160}
          ariaLabel="Intervention actions"
          items={[
            { key: 'rename', icon: 'solar:pen-linear', label: 'Rename', disabled: !canEdit },
            { key: 'delete', icon: 'solar:trash-bin-trash-linear', label: 'Remove', danger: true, disabled: !canEdit },
          ]}
          onSelect={(k) => {
            setMoreMenu(null);
            if (k === 'rename') { setTitleDraft(live.title); setEditingTitle(true); }
            if (k === 'delete') setConfirm({ kind: 'intervention' });
          }}
          onClose={() => setMoreMenu(null)}
        />
      )}

      {linkGoalOpen && (
        <LinkGoalToBarrierDrawer
          title="Link Goal to Intervention"
          goals={(slice?.goals || []).filter(g => g.id !== live.goalId)}
          onClose={() => setLinkGoalOpen(false)}
          onLink={async (ids) => {
            const first = Array.isArray(ids) ? ids[0] : ids;
            if (!first) { setLinkGoalOpen(false); return; }
            await savePatientCarePlanIntervention(patientId, program, { ...live, goalId: first }, live.id);
            setLinkGoalOpen(false);
          }}
        />
      )}

      {confirm?.kind === 'intervention' && (
        <ConfirmDialog
          variant="error"
          title={`Remove "${live.title}"?`}
          description="This removes it from the patient's care plan. This action cannot be undone."
          confirmLabel="Remove"
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            await deletePatientCarePlanIntervention(patientId, program.id, live.id);
            setConfirm(null);
            onClose?.();
          }}
        />
      )}

      {confirm?.kind === 'note' && (
        <ConfirmDialog
          variant="error"
          title="Delete this note?"
          description="The note will be removed from this intervention's activity."
          confirmLabel="Delete"
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            await deleteCarePlanNote(patientId, program.id, confirm.id);
            setConfirm(null);
          }}
        />
      )}
    </Drawer>
  );
}
