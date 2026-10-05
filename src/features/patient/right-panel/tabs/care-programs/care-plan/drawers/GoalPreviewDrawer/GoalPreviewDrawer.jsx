import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Drawer } from '../../../../../../../../components/Drawer/Drawer';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { FilterChip } from '../../../../../../../../components/FilterChip/FilterChip';
import { Badge } from '../../../../../../../../components/Badge/Badge';
import { Button } from '../../../../../../../../components/Button/Button';
import { Select } from '../../../../../../../../components/Select/Select';
import { Input } from '../../../../../../../../components/Input/Input';
import { Textarea } from '../../../../../../../../components/Textarea/Textarea';
import { Avatar } from '../../../../../../../../components/Avatar/Avatar';
import { ActionButton } from '../../../../../../../../components/ActionButton/ActionButton';
import { Slider } from '../../../../../../../../components/ShadcnSlider/ShadcnSlider';
import { PriorityIcon } from '../../../../../../../../components/PriorityIcon/PriorityIcon';
import { DetailDropdown } from '../../../../../../../tasks/TasksViewDropdowns';
import { PRIORITY_OPTIONS } from '../../../../../../../tasks/TasksView.utils';
import { TabStrip } from '../../../../../../../../components/TabStrip/TabStrip';
import { ActivityLog } from '../../../../../../../../components/ActivityLog/ActivityLog';
import { MenuPopover } from '../../../../../../../../components/MenuPopover/MenuPopover';
import { ConfirmDialog } from '../../../../../../../../components/ConfirmDialog/ConfirmDialog';
import {
  AlertDialog,
  AlertDialogContent,
} from '../../../../../../../../components/ConfirmDialog/AlertDialogPrimitives';
import { RadioButton } from '../../../../../../../../components/RadioButton/RadioButton';
// Reuse the RecordsRequestDialog CSS module so this destructive picker
// carries the same 12px radius shell, header typography, and full-width
// footer buttons the QA / Compliance role picker uses. Same visual
// system across every radio-body dialog in the app.
import dialogStyles from '../../../../../../../hcc/DiagPanel/RecordsRequestDialog.module.css';
import { useAppStore } from '../../../../../../../../store/useAppStore';
import { INTERVENTION_EDITORS } from '../../../../../../../settings/care-plan-library/interventions';
import { AddTaskDrawer } from '../../../../../../../tasks/AddTaskDrawer';
import { buildInterventionRecordFromConfig } from '../../lib/carePlanInterventionMenu';
import { CreateGoalDrawer } from '../../../../../../../settings/care-plan-library/goals/CreateGoalDrawer/CreateGoalDrawer';
import { GoalLinkedInterventionsList } from './GoalLinkedInterventionsList';
import { GoalLinkedBarriersList } from './GoalLinkedBarriersList';
import { computeDueDate, formatRecurrenceLabel } from '../../tables/CarePlanInterventionsTable';
import { parseCarePlanDate } from '../../tables/carePlanTableModel';
import { useScrollToSection } from '../../lib/useScrollToSection';
import { Tooltip } from '../../../../../../../../components/Tooltip/Tooltip';
import { formatGoalTarget, formatGoalDuration, formatGoalFrequency } from '../../../../../../../settings/care-plan-library/lib';
import { goalProgressBand, goalProgressTone } from '../../lib/goalMetrics';
import { goalCascade, barrierGoalIdsOf } from '../../lib/carePlanGoalCascade';
import { RemoveGoalDialog } from '../RemoveGoalDialog';
import { LinkItemsToGoalDrawer } from './LinkItemsToGoalDrawer';
import styles from './GoalPreviewDrawer.module.css';
import barrierStyles from '../BarrierDetailDrawer/BarrierDetailDrawer.module.css';
import { DownChevronIcon } from '../../../../../../../../components/Icon/DownChevronIcon';

const GBI_STATUSES = ['Not Started', 'In Progress', 'On Hold', 'Met', 'Not Met'];

/** Session-persisted accordion open state for Goal Details sections. */
const GOAL_PREVIEW_SECTIONS_KEY = 'fold.carePlan.goalPreview.sections';
const GOAL_PREVIEW_SECTIONS_DEFAULT = {
  trends: true,
  interventions: false,
  barriers: false,
  automations: false,
};

function readGoalPreviewSectionsOpen() {
  try {
    const raw = sessionStorage.getItem(GOAL_PREVIEW_SECTIONS_KEY);
    if (!raw) return { ...GOAL_PREVIEW_SECTIONS_DEFAULT };
    return { ...GOAL_PREVIEW_SECTIONS_DEFAULT, ...JSON.parse(raw) };
  } catch {
    return { ...GOAL_PREVIEW_SECTIONS_DEFAULT };
  }
}

function persistGoalPreviewSectionsOpen(next) {
  try {
    sessionStorage.setItem(GOAL_PREVIEW_SECTIONS_KEY, JSON.stringify(next));
  } catch {
    /* private mode / quota */
  }
}

const ACTIVITY_TABS = [
  { key: 'all', label: 'All' },
  { key: 'since', label: 'Since Last Visit' },
];
const ACTIVITY_FILTERS = [
  { key: 'all', label: 'All activity' },
  { key: 'note', label: 'Notes' },
  { key: 'status_changed', label: 'Status' },
  { key: 'progress_changed', label: 'Progress' },
  { key: 'value_changed', label: 'Values' },
];
const PRIORITIES = ['high', 'medium', 'low'];
const STATUS_TONE = {
  'Not Started': 'grey',
  'In Progress': 'warning',
  'On Hold': 'grey',
  Met: 'success',
  'Not Met': 'error',
};

// `progressBand` / `progressTone` moved to `../../lib/goalMetrics.js` as
// `goalProgressBand` / `goalProgressTone` so the audit-log detail and the
// drawer label read from one source of truth.
const progressBand = goalProgressBand;
const progressTone = goalProgressTone;

// Progress slider fill / thumb color per band — fed to the slider via
// the `--slider-tone` CSS variable so the CSS module can flip the fill
// without changing markup. Mirrors the InterventionPreviewDrawer.
function progressSliderColor(pct) {
  const tone = progressTone(progressBand(pct));
  if (tone === 'error') return 'var(--status-error)';
  if (tone === 'warning') return 'var(--status-warning)';
  if (tone === 'success') return 'var(--status-success)';
  return 'var(--neutral-300)';
}

function relativeLabel(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 60) return `${mins || 1}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.round(months / 12)}y`;
}

function fmtDate(iso) {
  // Date-only values (target dates) parse locally, never as UTC midnight.
  const d = parseCarePlanDate(iso);
  if (!d) return '';
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

// Rebuild the goal's descriptive subtitle from its structured values so the
// hero line ("Blood pressure < 140/90 mmHg • Daily • 3 Months") reflects edits made in
// the Edit Goal drawer. Returns '' when there's nothing structured to show.
function buildGoalSubtitle(g) {
  const target = formatGoalTarget(g);
  const dur = formatGoalDuration(g);
  const left = [g.measure, target].filter(Boolean).join(' ').trim();
  // Frequency stays its own part (see the plan table's meta line).
  const freq = target ? formatGoalFrequency(g) : '';
  return [left, freq, dur].filter(Boolean).join(' • ');
}

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
    return { ...base, t: 'comment', title: 'Added a Note', commentBody: `Note: ${e.detail || ''}`, comment: e.detail, verb: 'added a', field: 'Note' };
  }
  if (e.action === 'note_deleted') {
    return { ...base, t: 'comment', title: 'Deleted a Note', commentBody: e.detail ? `Note: ${e.detail}` : '', comment: e.detail, verb: 'deleted a', field: 'Note' };
  }
  if (e.action === 'created') return { ...base, t: 'default', title: 'added a Goal', verb: 'added a', field: 'Goal' };
  if (e.action === 'deleted') return { ...base, t: 'default', title: 'removed a Goal', verb: 'removed a', field: 'Goal' };
  if (e.action === 'status_changed') {
    return { ...base, t: 'status_change', title: 'Status', from, to, verb: 'changed the', field: 'Status', fromTone: STATUS_TONE[from] || 'grey', toTone: STATUS_TONE[to] || 'grey' };
  }
  if (e.action === 'progress_changed') {
    return { ...base, t: 'status_change', title: 'Progress', from, to, verb: 'changed the', field: 'Progress', fromTone: progressTone(from), toTone: progressTone(to) };
  }
  if (e.action === 'value_changed') {
    if (from && to) return { ...base, t: 'status_change', title: 'Value', from, to, verb: 'changed the', field: 'Value', fromTone: 'grey', toTone: 'grey' };
    return { ...base, t: 'comment', title: 'Added a Value', commentBody: e.detail || '', comment: e.detail, verb: 'added a', field: 'Value' };
  }
  return { ...base, t: 'default', title: e.summary || 'updated', verb: 'updated', field: e.summary || 'Goal' };
}

function sparkNum(v) {
  const m = String(v).match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : NaN;
}

function Sparkline({ values }) {
  const nums = values.map(sparkNum).filter(n => !Number.isNaN(n));
  if (nums.length < 2) return <span className={styles.sparkEmpty}>—</span>;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const w = 85;
  const h = 47;
  const padX = 8;
  const padY = 6;
  const step = nums.length > 1 ? (w - padX * 2) / (nums.length - 1) : 0;
  const pts = nums.map((n, i) => ({
    x: padX + i * step,
    y: h - padY - ((n - min) / span) * (h - padY * 2),
  }));
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={styles.spark} aria-hidden="true">
      {pts.map((p, i) => {
        const last = i === pts.length - 1;
        const stroke = last ? 'var(--accent-blue)' : 'var(--neutral-150)';
        return (
          <g key={i}>
            <line x1={p.x} y1={h - padY} x2={p.x} y2={p.y} stroke={stroke} strokeWidth="1" strokeLinecap="round" />
            <circle cx={p.x} cy={p.y} r={last ? 2.5 : 2} fill={last ? 'var(--accent-blue)' : 'var(--neutral-200)'} />
          </g>
        );
      })}
    </svg>
  );
}

// Section head — matches the InterventionPreviewDrawer's Linked Goals
// treatment (barrierStyles.sectionHead / sectionToggle / sectionTitle /
// sectionChevron), so every collapsible section in the goal drawer
// reads with the same title weight, chevron placement, and hover
// affordance. `muted` is preserved as a flag but the styling no longer
// diverges — the visual language is now unified.
const AccordionHead = function AccordionHead({
  title,
  open,
  onToggle,
  onAdd,
  addTooltip,
  canEdit,
  addRef,
  addAriaHasPopup,
  addAriaExpanded,
  onLinkExisting,
  linkTooltip,
  linkRef,
  linkMenuOpen,
}) {
  return (
    <div className={barrierStyles.sectionHead}>
      <button
        type="button"
        className={barrierStyles.sectionToggle}
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className={barrierStyles.sectionTitle}>{title}</span>
        <DownChevronIcon
          size={12}
          color="var(--neutral-400)"
          className={`${barrierStyles.sectionChevron} ${open ? barrierStyles.sectionChevronOpen : ''}`}
        />
      </button>
      {canEdit && (
        <div className={styles.sectionActions}>
          {onLinkExisting && (
            <>
              <ActionButton
                ref={linkRef}
                icon="solar:link-round-linear"
                size="S"
                tooltip={linkTooltip || 'Link existing'}
                onClick={onLinkExisting}
                aria-haspopup="dialog"
                aria-expanded={linkMenuOpen}
              />
              <span className={styles.headerDivider} aria-hidden="true" />
            </>
          )}
          <ActionButton
            ref={addRef}
            icon="solar:add-linear"
            size="S"
            tooltip={addTooltip}
            onClick={onAdd}
            aria-haspopup={addAriaHasPopup}
            aria-expanded={addAriaExpanded}
          />
        </div>
      )}
    </div>
  );
};

// Same intervention kinds the settings-side CreateGoalDrawer offers so
// the popover looks and behaves identically here (Send Form / Patient
// Education / Patient Task / Measure Vital / Internal Task).
const INTERVENTION_KIND_ITEMS = [
  { key: 'send-form', label: 'Send Form', icon: 'solar:document-add-linear' },
  { key: 'patient-education', label: 'Patient Education', icon: 'solar:book-2-linear' },
  { key: 'patient-task', label: 'Patient Task', icon: 'solar:checklist-minimalistic-linear' },
  { key: 'measure-vital', label: 'Measure Vital', icon: 'solar:heart-pulse-linear' },
  { divider: true },
  { key: 'internal-task', label: 'Internal Task', icon: 'solar:clipboard-check-linear' },
];

// Scope choices offered when the reviewer deletes a linked
// intervention from the Goal Details drawer. Each key drives a
// downstream delete surface (currently the same call for all — the
// template-scoped / global deletes are not wired yet, so the picker
// just captures the intent and toasts the chosen scope).
const SCOPE_LABEL = {
  'this-goal':      "this goal on this template",
  'all-templates':  "this goal on every linked template",
  'everywhere':     "everywhere in the plan",
};
const SCOPE_OPTIONS = [
  { value: 'this-goal',     label: 'From this goal on this template' },
  { value: 'all-templates', label: 'From this goal on all linked templates' },
  { value: 'everywhere',    label: 'From everywhere in the plan' },
];

/** Radio-picker dialog for the "Delete intervention / barrier" scope
 *  choice. Reuses the AlertDialog primitives that back ConfirmDialog
 *  (scrim, focus trap, escape-to-close, enter animation) plus the
 *  RecordsRequestDialog CSS module so this destructive picker reads as
 *  the same primitive as the QA / Compliance record request modal:
 *  12px radius shell, 16px padding, header typography, full-width
 *  Cancel + primary action pair. The primary is `danger` per the
 *  design system's destructive-primary rule. */
function IntvDeleteScopePicker({ name, kindLabel = 'intervention', onCancel, onConfirm }) {
  const [scope, setScope] = useState('this-goal');
  return (
    <AlertDialog open onOpenChange={(open) => { if (!open) onCancel?.(); }}>
      <AlertDialogContent className={dialogStyles.dialog}>
        <div className={dialogStyles.header}>
          <h2 className={dialogStyles.title}>Delete &ldquo;{name}&rdquo;?</h2>
          <p className={dialogStyles.subtitle}>
            Pick where this {kindLabel} should be removed from.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {SCOPE_OPTIONS.map((opt) => (
            <RadioButton
              key={opt.value}
              checked={scope === opt.value}
              onChange={() => setScope(opt.value)}
              label={opt.label}
            />
          ))}
        </div>
        <div className={dialogStyles.actions}>
          <Button variant="secondary" size="L" onClick={onCancel}>Cancel</Button>
          <Button variant="danger" size="L" onClick={() => onConfirm(scope)}>Delete</Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Goal Details — Figma SNP-Story 2632:81504.
 * Every edit (status, progress, readings, automations, notes, interventions,
 * barriers) writes through the care-plan store into Supabase.
 */
export function GoalPreviewDrawer({ goal, patientId, program, onClose, onOpenIntervention, onOpenBarrier, consolidated = false, focusSection = null }) {
  const key = patientId && program ? `${patientId}::${program.id}` : null;
  const slice = useAppStore(s => (key ? s.patientCarePlans[key] : null));
  const audit = useAppStore(s => (key ? s.patientCarePlanAudit[key] : null)) || [];
  const lastVisit = useAppStore(s => {
    const p = (s.patients || []).find(x => x.id === patientId)
      || (s.allPatients || []).find(x => x.id === patientId);
    return p?.lastVisit || p?.last_visit || null;
  });
  const currentUserName = useAppStore(s => s.currentUserProfile?.name);
  const savePatientCarePlanGoal = useAppStore(s => s.savePatientCarePlanGoal);
  const deletePatientCarePlanGoal = useAppStore(s => s.deletePatientCarePlanGoal);
  const saveGoalMeasurement = useAppStore(s => s.saveGoalMeasurement);
  const deleteGoalMeasurement = useAppStore(s => s.deleteGoalMeasurement);
  const saveCarePlanAutomation = useAppStore(s => s.saveCarePlanAutomation);
  const deleteCarePlanAutomation = useAppStore(s => s.deleteCarePlanAutomation);
  const savePatientCarePlanIntervention = useAppStore(s => s.savePatientCarePlanIntervention);
  const deletePatientCarePlanIntervention = useAppStore(s => s.deletePatientCarePlanIntervention);
  const savePatientCarePlanBarrier = useAppStore(s => s.savePatientCarePlanBarrier);
  const deletePatientCarePlanBarrier = useAppStore(s => s.deletePatientCarePlanBarrier);
  const addCarePlanNote = useAppStore(s => s.addCarePlanNote);
  const logCarePlanAudit = useAppStore(s => s.logCarePlanAudit);
  const showToast = useAppStore(s => s.showToast);
  const updateCarePlanNote = useAppStore(s => s.updateCarePlanNote);
  const deleteCarePlanNote = useAppStore(s => s.deleteCarePlanNote);
  const fetchCarePlanAudit = useAppStore(s => s.fetchCarePlanAudit);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  const platformUsers = useAppStore(s => s.platformUsers);
  const patientName = useAppStore(s => {
    const p = (s.patients || []).find(x => x.id === patientId)
      || (s.allPatients || []).find(x => x.id === patientId);
    return p?.name;
  });
  const patientInitials = useAppStore(s => {
    const p = (s.patients || []).find(x => x.id === patientId)
      || (s.allPatients || []).find(x => x.id === patientId);
    return p?.initials;
  });
  // Patient record for GoalLinkedInterventionsList — memoised so
  // Zustand's default reference-equality doesn't tear us down on
  // every render (returning a fresh object literal inside a selector
  // triggers an infinite update loop → white screen).
  const patient = useMemo(
    () => (patientId ? { id: patientId, name: patientName, initials: patientInitials } : null),
    [patientId, patientName, patientInitials],
  );

  const live = (slice?.goals || []).find(g => g.id === goal?.id) || goal;

  // Shared lookup used to enrich each intervention / barrier row with
  // the goals it's ALSO linked to (excluding this open goal). The
  // GbiLinkButton on the row rail hides itself when the resulting
  // "other" list is empty, so interventions (single-goal today) show
  // nothing while multi-goal barriers surface a link icon with the
  // count of the OTHER goals they're wired onto.
  const otherLinkedGoalsFor = (linkedGoalIds) => {
    const otherIds = (linkedGoalIds || [])
      .map(String)
      .filter(id => id !== String(live?.id));
    if (otherIds.length === 0) return { goals: [] };
    const byId = new Map((slice?.goals || []).map(g => [String(g.id), g]));
    return {
      goals: otherIds
        .map(id => byId.get(id))
        .filter(Boolean)
        .map(g => ({ id: g.id, title: g.title, icon: g.icon })),
    };
  };

  const interventions = useMemo(
    () => (slice?.interventions || [])
      .filter(i => String(i.goalId) === String(live?.id))
      .map(i => ({
        ...i,
        // Interventions carry a single goalId today, so this list is
        // always empty for now. Wiring it here keeps the row rail
        // parity with barriers when the model grows to many-goals.
        linkedPreview: otherLinkedGoalsFor(i.goalId ? [i.goalId] : []),
      })),
    [slice, live],
  );
  const barriers = useMemo(() => (slice?.barriers || [])
    .filter(b => barrierGoalIdsOf(b).map(String).includes(String(live?.id)))
    .map(b => ({
      ...b,
      linkedPreview: otherLinkedGoalsFor(barrierGoalIdsOf(b)),
    })), [slice, live?.id]);

  // Candidate lists for the multi-select "Link existing" drawer: only
  // items NOT already linked to this goal show up in the picker. This
  // mirrors LinkGoalToBarrierDrawer's add-only shape used by the
  // Intervention / Barrier detail drawers when linking goals.
  const interventionLinkCandidates = useMemo(
    () => {
      const goalById = new Map(
        (slice?.goals || []).map(g => [String(g.id), g]),
      );
      return (slice?.interventions || [])
        .filter(i => String(i.goalId) !== String(live?.id))
        .map(i => {
          const kindMeta = INTERVENTION_KIND_ITEMS.find(k => k.key === i.kind);
          const due = computeDueDate(i);
          const isRecurring = !!i.config?.repeat;
          // Second line reads like the intervention row inside the
          // Goal Details drawer: "Due <date> [↻]". Recurring glyph
          // gets a tooltip explaining the cadence.
          const subtitleNode = (due.formatted || isRecurring) ? (
            <span
              className="_linkItemDueLine"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-1)',
                fontSize: 'var(--font-sm)',
                color: 'var(--neutral-300)',
              }}
            >
              {due.formatted ? `Due ${due.formatted}` : null}
              {isRecurring && (
                <Tooltip label={formatRecurrenceLabel(i)}>
                  <span aria-label={formatRecurrenceLabel(i)} style={{ display: 'inline-flex' }}>
                    <Icon name="solar:refresh-linear" size={14} color="var(--neutral-300)" />
                  </span>
                </Tooltip>
              )}
            </span>
          ) : null;
          const linkedGoal = goalById.get(String(i.goalId));
          return {
            id: i.id,
            title: i.title,
            subtitleNode,
            priority: i.priority,
            badge: kindMeta?.label,
            // Right-rail affordance mirrors the plan-level table: a
            // link icon with a count badge, hover pops a preview of
            // the goal this intervention is already wired onto (an
            // intervention only lives on a single goal, so this is
            // 0 or 1 entries).
            linkedPreview: linkedGoal
              ? { goals: [{ id: linkedGoal.id, title: linkedGoal.title, icon: linkedGoal.icon }] }
              : { goals: [] },
          };
        });
    },
    [slice?.interventions, slice?.goals, live?.id],
  );

  const barrierLinkCandidates = useMemo(
    () => {
      const goalById = new Map(
        (slice?.goals || []).map(g => [String(g.id), g]),
      );
      return (slice?.barriers || [])
        .filter(b => !barrierGoalIdsOf(b).map(String).includes(String(live?.id)))
        .map(b => {
          const linkedGoals = barrierGoalIdsOf(b)
            .map(id => goalById.get(String(id)))
            .filter(Boolean)
            .map(g => ({ id: g.id, title: g.title, icon: g.icon }));
          return {
            id: b.id,
            title: b.title,
            subtitle: b.subtitle || null,
            // Right-rail affordance uses the same GbiLinkButton the
            // plan-level table shows: a link icon with a count badge
            // that pops a preview of the linked goals on hover.
            linkedPreview: { goals: linkedGoals },
          };
        });
    },
    [slice?.barriers, slice?.goals, live?.id],
  );
  const measurements = useMemo(
    () => (slice?.measurements || []).filter(m => m.goalId === live?.id).slice().sort((a, b) => new Date(a.takenAt) - new Date(b.takenAt)),
    [slice, live],
  );
  const automations = useMemo(() => (slice?.automations || []).filter(a => !a.goalId || a.goalId === live?.id), [slice, live]);

  const [pct, setPct] = useState(Number(live?.progress) || 0);
  const [pctDragging, setPctDragging] = useState(false);
  const [open, setOpen] = useState(readGoalPreviewSectionsOpen);
  const patchSectionsOpen = useCallback((updater) => {
    setOpen((prev) => (typeof updater === 'function' ? updater(prev) : updater));
  }, []);
  useEffect(() => {
    persistGoalPreviewSectionsOpen(open);
  }, [open]);
  const [addingReading, setAddingReading] = useState(false);
  const [readingValue, setReadingValue] = useState('');
  const [readingFavorable, setReadingFavorable] = useState(true);
  const [addingAutomation, setAddingAutomation] = useState(false);
  const [automationTitle, setAutomationTitle] = useState('');
  const [addingBarrier, setAddingBarrier] = useState(false);
  const [barrierTitle, setBarrierTitle] = useState('');
  const [intvOpen, setIntvOpen] = useState(false);
  // Kind-picker popover state. `intvMenuOpen` toggles the MenuPopover
  // anchored to the Interventions "+" button; `intvSelectedKind` is the
  // item the user picked, seeded onto the AddInterventionDrawer that
  // then opens.
  const [intvMenuOpen, setIntvMenuOpen] = useState(false);
  const [intvLinkMenuOpen, setIntvLinkMenuOpen] = useState(false);
  const [barrierLinkMenuOpen, setBarrierLinkMenuOpen] = useState(false);
  const [intvSelectedKind, setIntvSelectedKind] = useState(null);
  const intvAddRef = useRef(null);
  const intvLinkRef = useRef(null);
  const barrierLinkRef = useRef(null);
  const [note, setNote] = useState('');
  const [notePlain, setNotePlain] = useState('');
  const [noteEditing, setNoteEditing] = useState(false);
  const [activityTab, setActivityTab] = useState('all');
  const [activityFilter, setActivityFilter] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [moreMenu, setMoreMenu] = useState(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [editGoalOpen, setEditGoalOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [priorityMenu, setPriorityMenu] = useState(null);
  const [rowMenu, setRowMenu] = useState(null);
  const [linkedStatusMenu, setLinkedStatusMenu] = useState(null);
  const moreBtnRef = useRef(null);
  const filterBtnRef = useRef(null);

  useEffect(() => { setPct(Number(live?.progress) || 0); }, [live?.id, live?.progress]);
  useEffect(() => { if (patientId && program) fetchCarePlanAudit(patientId, program.id); }, [patientId, program, fetchCarePlanAudit]);

  // Latest saved note on this goal — mirrors intervention / barrier
  // drawers. A subsequent `note_deleted` entry hides the note card but
  // the original "Added a Note" + the delete row stay in the Activity
  // Log.
  const latestGoalNote = useMemo(() => {
    const forThis = audit.filter(a => String(a.entityId) === String(live?.id));
    const notes = forThis
      .filter(a => a.action === 'note' && (a.entityType === 'goal' || a.entityType === 'note'))
      .sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt));
    const latestNote = notes[0];
    if (!latestNote) return null;
    const latestClear = forThis
      .filter(a => a.action === 'note_deleted')
      .sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt))[0];
    if (latestClear && new Date(latestClear.createdAt) >= new Date(latestNote.createdAt)) return null;
    return latestNote;
  }, [audit, live?.id]);

  // Re-seed the editor whenever a new note lands (drawer opens on a
  // different goal or a fresh note was just saved). Exit edit mode after
  // a save so the read-only card reappears.
  useEffect(() => {
    const seed = latestGoalNote?.detail || '';
    setNote(seed);
    setNotePlain(seed);
    setNoteEditing(false);
  }, [latestGoalNote?.id]);
  useEffect(() => { fetchPlatformUsers?.(); }, [fetchPlatformUsers]);

  const activity = useMemo(() => {
    // Goal activity now folds in the audit trail for every intervention
    // and barrier currently linked to this goal. Any status / progress /
    // due-date / recurrence / assignee / link change on those items
    // shows up in the goal's history too so the reviewer doesn't have
    // to open each child drawer to see what moved.
    const linkedIntvIds = new Set(interventions.map(i => String(i.id)));
    const linkedBarrierIds = new Set(barriers.map(b => String(b.id)));
    const rows = audit
      .filter(a => {
        if (String(a.entityId) === String(live?.id)) return true;
        if (a.entityType === 'intervention') return linkedIntvIds.has(String(a.entityId));
        if (a.entityType === 'barrier') return linkedBarrierIds.has(String(a.entityId));
        return false;
      })
      .map(mapAuditEntry);
    const sinceCutoff = (() => {
      if (lastVisit) {
        const t = new Date(lastVisit).getTime();
        if (!Number.isNaN(t)) return t;
      }
      return Date.now() - 30 * 86400000;
    })();
    const filtered = rows.filter(e => {
      if (activityTab === 'since' && e.createdAt && new Date(e.createdAt).getTime() < sinceCutoff) return false;
      if (activityFilter !== 'all' && e.action !== activityFilter) return false;
      return true;
    });
    // Group by "MMM YYYY" and inject `{ t: 'group', label }` markers
    // between entries so the shared ActivityLog renders collapsible
    // month separators (e.g. "Sep 2026") with the built-in chevron.
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const bucketLabel = (iso) => {
      if (!iso) return 'Undated';
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return 'Undated';
      return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    };
    const out = [];
    let currentBucket = null;
    for (const entry of filtered) {
      const bucket = bucketLabel(entry.createdAt);
      if (bucket !== currentBucket) {
        out.push({ t: 'group', label: bucket });
        currentBucket = bucket;
      }
      out.push(entry);
    }
    return out;
  }, [audit, live, interventions, barriers, activityTab, activityFilter, lastVisit]);
  const noteSectionRef = useRef(null);
  useScrollToSection(noteSectionRef, focusSection === 'notes', live?.id);

  if (!live) return null;

  const canEdit = !!(patientId && program);
  const unit = live.customUnit || measurements[0]?.unit || '';
  const youSuffix = (name) => (name && currentUserName && name === currentUserName ? ` by ${name} (You)` : name ? ` by ${name}` : '');

  const toggle = (k) => patchSectionsOpen(s => ({ ...s, [k]: !s[k] }));
  const expandAnd = (k, fn) => { patchSectionsOpen(s => ({ ...s, [k]: true })); fn(); };

  const commitProgress = (v) => {
    const next = v[0];
    if (next === (live.progress ?? 0)) return;
    savePatientCarePlanGoal(patientId, program, { ...live, progress: next }, live.id);
  };

  const changeStatus = (status) => {
    if (!canEdit || status === live.status) return;
    savePatientCarePlanGoal(patientId, program, { ...live, status }, live.id);
  };

  const commitTitle = () => {
    const next = titleDraft.trim();
    setEditingTitle(false);
    if (!next || next === live.title) return;
    savePatientCarePlanGoal(patientId, program, { ...live, title: next }, live.id);
  };

  // Full-detail edit via the shared Goals Library drawer. Its onSave returns the
  // whole goal shape (title/priority/target/duration/…); merge onto the live
  // goal so unrelated fields (subtitle, icon, status, progress) are preserved.
  // `interventions` from the drawer is ignored — care-plan interventions are
  // managed separately and the goal row mapper drops the field.
  const handleSaveGoalEdit = async (values) => {
    setEditGoalOpen(false);
    const merged = { ...live, ...values };
    // Regenerate the subtitle from the edited structured values (keep the old
    // one only if the edit leaves nothing structured to render).
    const subtitle = buildGoalSubtitle(merged);
    if (subtitle) merged.subtitle = subtitle;
    const saved = await savePatientCarePlanGoal(patientId, program, merged, live.id);
    if (saved) showToast?.('Goal updated');
  };

  const submitReading = async () => {
    if (!readingValue.trim()) return;
    await saveGoalMeasurement(patientId, program.id, live.id, { value: readingValue.trim(), unit, favorable: readingFavorable });
    setReadingValue(''); setReadingFavorable(true); setAddingReading(false);
  };

  const submitAutomation = async () => {
    if (!automationTitle.trim()) return;
    await saveCarePlanAutomation(patientId, program, live.id, { title: automationTitle.trim() });
    setAutomationTitle(''); setAddingAutomation(false);
  };

  const submitBarrier = async () => {
    if (!barrierTitle.trim()) return;
    await savePatientCarePlanBarrier(patientId, program, { title: barrierTitle.trim(), goalId: live.id, status: 'Not Started', priority: live.priority || 'medium' });
    setBarrierTitle(''); setAddingBarrier(false);
  };

  const submitNote = async () => {
    const body = (notePlain || note).replace(/<[^>]+>/g, '').trim();
    if (!body) return;
    await addCarePlanNote(patientId, program, body, { entityType: 'goal', entityId: live.id, summary: `Note on ${live.title}` });
    setNoteEditing(false);
  };

  const handleAssigneeChange = (intervention, user) => {
    if (!canEdit) return;
    savePatientCarePlanIntervention(
      patientId,
      program,
      { ...intervention, assignee: { name: user.name, initials: user.initials } },
      intervention.id,
    );
    showToast?.(`Assigned to ${user.name}`);
  };

  const changeLinkedItemStatus = (status) => {
    const { kind, item } = linkedStatusMenu || {};
    setLinkedStatusMenu(null);
    if (!item || !canEdit || status === item.status) return;
    if (kind === 'barrier') {
      savePatientCarePlanBarrier(patientId, program, { ...item, status }, item.id);
      return;
    }
    savePatientCarePlanIntervention(patientId, program, { ...item, status }, item.id);
  };

  // Inline-edit hook for the Due Date on a linked intervention row.
  // Persists the picked ISO into `config.dueDateOverride` so the same
  // computeDueDate helper the table uses picks it up.
  const handleDueDateChange = async (intv, iso) => {
    if (!intv || !canEdit) return;
    const nextConfig = { ...(intv.config || {}), dueDateOverride: iso || null };
    await savePatientCarePlanIntervention(
      patientId,
      program,
      { ...intv, config: nextConfig },
      intv.id,
    );
  };
  // Recurrence updates from the RepeatEditor footer inside the date
  // picker. Same shape as CarePlanInterventionsTable's callback: the
  // repeat flags land inside `config` so computeOccurrenceDates and
  // formatRecurrenceLabel read them back.
  const handleRecurrenceChange = async (intv, patch) => {
    if (!intv || !canEdit) return;
    const nextConfig = { ...(intv.config || {}), ...patch };
    await savePatientCarePlanIntervention(
      patientId,
      program,
      { ...intv, config: nextConfig },
      intv.id,
    );
  };

  const toggleInterventionLink = async (interventionId, linked) => {
    const intv = (slice?.interventions || []).find(i => i.id === interventionId);
    if (!intv || !canEdit) return;
    await savePatientCarePlanIntervention(
      patientId,
      program,
      { ...intv, goalId: linked ? live.id : null },
      intv.id,
    );
    patchSectionsOpen(s => ({ ...s, interventions: true }));
  };

  const toggleBarrierLink = async (barrierId, linked) => {
    const barrier = (slice?.barriers || []).find(b => b.id === barrierId);
    if (!barrier || !canEdit) return;
    const gid = String(live.id);
    let nextIds = barrierGoalIdsOf(barrier).map(String);
    if (linked) {
      if (!nextIds.includes(gid)) nextIds = [...nextIds, gid];
    } else {
      nextIds = nextIds.filter(id => id !== gid);
    }
    await savePatientCarePlanBarrier(
      patientId,
      program,
      { ...barrier, goalIds: nextIds, goalId: nextIds[0] || null },
      barrier.id,
    );
    patchSectionsOpen(s => ({ ...s, barriers: true }));
  };

  const changePriority = (priority) => {
    const { kind, item } = priorityMenu;
    setPriorityMenu(null);
    if (kind === 'intv') {
      savePatientCarePlanIntervention(patientId, program, { ...item, priority }, item.id);
    }
  };

  const programBadges = [program?.code].filter(Boolean);
  const conditionBadges = (live.conditions?.length
    ? live.conditions
    : (slice?.plan?.conditions || []).map(c => (typeof c === 'string' ? c : c.label)).filter(Boolean)
  ).slice(0, 4);

  // Single hero meta line: Start · Target · Last Updated (with the
  // "by <name>" attribution when we know who saved it). A goal without a
  // target date says so; no date is projected for it. The target is a
  // date-only value, so it's formatted without a UTC shift.
  const metaParts = [
    live.createdAt ? `Start Date : ${fmtDate(live.createdAt)}` : null,
    `Target Date : ${fmtDate(live.targetDate) || 'Not set'}`,
    live.updatedAt ? `Last Updated : ${fmtDate(live.updatedAt)}${youSuffix(live.updatedBy)}` : null,
  ].filter(Boolean);
  // Goal type / category (Vitals, Exercise, Diet, Labs, Assessment,
  // Others) — same field the plan-level Goals table renders as a
  // right-aligned Type badge. Falls back to `type` for older records.
  const goalTypeLabel = live.category || live.type || null;

  // Edit mode replaces this drawer's surface with the shared Goals Library
  // drawer (rather than stacking a second drawer on top). Cancel/Save both
  // return to Goal Details.
  if (editGoalOpen) {
    return (
      <CreateGoalDrawer
        goal={live}
        onClose={() => setEditGoalOpen(false)}
        onSave={handleSaveGoalEdit}
      />
    );
  }

  return (
    <Drawer title="Goal Details" onClose={onClose} bodyClassName={styles.drawerPad}>
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
          {/* Read-only-plus (consolidated view opened from the Comprehensive
              Care Plan tab): Edit Goal + More live outside the allow-list
              (status / progress / trends / note only), so drop the whole
              action cluster in that mode. */}
          {!consolidated && (
            <div className={styles.statusActions}>
              <ActionButton
                icon="solar:pen-linear"
                size="L"
                tooltip="Edit Goal"
                disabled={!canEdit}
                onClick={() => setEditGoalOpen(true)}
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
            </div>
          )}
        </div>

        <div className={styles.hero}>
          <div className={styles.titleRow}>
            <span className={styles.priorityTrigger}>
              {consolidated ? (
                <PriorityIcon priority={live.priority} size={20} />
              ) : (
                <DetailDropdown
                  value={live.priority}
                  options={PRIORITY_OPTIONS}
                  onSelect={(v) => {
                    if (!canEdit || v === live.priority) return;
                    savePatientCarePlanGoal(patientId, program, { ...live, priority: v }, live.id);
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
              )}
            </span>
            {editingTitle && !consolidated ? (
              <input
                autoFocus
                type="text"
                className={styles.titleInlineInput}
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={e => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                aria-label="Goal title"
              />
            ) : (
              <button
                type="button"
                className={styles.titleEditable}
                onClick={() => {
                  if (!canEdit || consolidated) return;
                  setTitleDraft(live.title || '');
                  setEditingTitle(true);
                }}
                disabled={!canEdit || consolidated}
                aria-label="Edit goal title"
              >
                {live.title}
              </button>
            )}
          </div>
          {live.subtitle && <span className={styles.subtitle}>{live.subtitle}</span>}
          {metaParts.length > 0 && <span className={styles.meta}>{metaParts.join(' • ')}</span>}
          {(goalTypeLabel || programBadges.length > 0 || conditionBadges.length > 0) && (
            <div className={styles.badges}>
              {goalTypeLabel && <Badge tone="grey" label={goalTypeLabel} />}
              {goalTypeLabel && (programBadges.length > 0 || conditionBadges.length > 0) && (
                <span className={styles.badgeDivider} />
              )}
              {programBadges.map(b => <Badge key={b} tone="grey" label={b} />)}
              {programBadges.length > 0 && conditionBadges.length > 0 && <span className={styles.badgeDivider} />}
              {conditionBadges.map(b => <Badge key={b} tone="grey" label={b} />)}
            </div>
          )}
        </div>

        <section className={styles.section}>
          <span className={styles.progressLabel}>Progress</span>
          <div className={`${styles.progressCard} ${styles.progressCardRow}`}>
            <div
              className={`${styles.progressWrap} ${styles.progressCardTrack}`}
              style={{ '--slider-tone': progressSliderColor(pct) }}
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
                onValueCommit={(v) => { commitProgress(v); setPctDragging(false); }}
                aria-label="Goal progress"
              />
            </div>
            <Badge
              size="S"
              tone={progressTone(progressBand(pct))}
              label={`${pct}% • ${progressBand(pct)}`}
            />
          </div>
        </section>

        <section className={styles.section}>
          <AccordionHead
            title="Last Trends"
            open={open.trends}
            onToggle={() => toggle('trends')}
            canEdit={canEdit}
            muted
            addTooltip="Add reading"
            onAdd={() => expandAnd('trends', () => setAddingReading(v => !v))}
          />
          {open.trends && (
            <>
              {addingReading && (
                <div className={styles.addRow}>
                  <Input
                    placeholder={unit ? `Value (${unit})` : 'Value'}
                    value={readingValue}
                    onChange={e => setReadingValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') submitReading(); }}
                    aria-label="Reading value"
                  />
                  <button
                    type="button"
                    className={`${styles.favorableToggle} ${readingFavorable ? styles.favorableOn : styles.favorableOff}`}
                    onClick={() => setReadingFavorable(v => !v)}
                  >
                    {readingFavorable ? 'In target' : 'Out of target'}
                  </button>
                  <Button variant="primary" size="S" onClick={submitReading} disabled={!readingValue.trim()}>Save</Button>
                </div>
              )}
              {measurements.length === 0 ? (
                <div className={styles.emptyCard}>No readings recorded yet.</div>
              ) : (
                <div className={styles.trendsCard}>
                  <div className={styles.trendsHead}>
                    <span>Last {measurements.length} Values{unit ? ` (${unit})` : ''}</span>
                    <span className={styles.trendsHeadRight}>Trend</span>
                  </div>
                  <div className={styles.trendsBody}>
                    <div className={styles.trendsValues}>
                      {measurements.map(m => (
                        <div key={m.id} className={styles.valueCol}>
                          <span className={`${styles.value} ${m.favorable ? styles.valueGood : styles.valueBad}`}>{m.value}</span>
                          <span className={styles.valueAge}>{relativeLabel(m.takenAt)}</span>
                          {canEdit && (
                            <button type="button" className={styles.valueRemove} onClick={() => deleteGoalMeasurement(patientId, program.id, m.id)} aria-label="Remove reading">
                              <Icon name="solar:close-circle-linear" size={12} color="var(--neutral-300)" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className={styles.trendsSpark}>
                      <Sparkline values={measurements.map(m => m.value)} />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* Interventions / Barriers / Automations sections. In the
            consolidated view (opened from the Comprehensive Care Plan
            tab) these sections auto-hide when nothing is linked, drop
            the "+" add affordance on the head, and render their rows
            read-only. */}
        {(!consolidated || interventions.length > 0) && (
          <section className={styles.accSection}>
            <AccordionHead
              title="Interventions"
              open={open.interventions}
              onToggle={() => toggle('interventions')}
              canEdit={canEdit && !consolidated}
              addTooltip="Add Intervention"
              addRef={intvAddRef}
              addAriaHasPopup="menu"
              addAriaExpanded={intvMenuOpen}
              onAdd={() => expandAnd('interventions', () => setIntvMenuOpen(v => !v))}
              linkRef={intvLinkRef}
              linkTooltip="Link existing intervention"
              linkMenuOpen={intvLinkMenuOpen}
              onLinkExisting={() => expandAnd('interventions', () => setIntvLinkMenuOpen(v => !v))}
            />
            {intvLinkMenuOpen && !consolidated && (
              <LinkItemsToGoalDrawer
                title="Link Intervention to Goal"
                items={interventionLinkCandidates}
                searchPlaceholder="Search Intervention"
                emptyAllLinkedLabel="Every intervention on this plan is already linked to this goal."
                emptyNoMatchLabel="No interventions match that search."
                onClose={() => setIntvLinkMenuOpen(false)}
                onLink={async (ids) => {
                  for (const id of ids) {
                    // eslint-disable-next-line no-await-in-loop
                    await toggleInterventionLink(id, true);
                  }
                }}
              />
            )}
            {intvMenuOpen && !consolidated && (
              <MenuPopover
                anchorRef={intvAddRef}
                align="right"
                width={200}
                ariaLabel="Add intervention"
                items={INTERVENTION_KIND_ITEMS}
                onSelect={(kind) => {
                  setIntvMenuOpen(false);
                  setIntvSelectedKind(kind);
                  setIntvOpen(true);
                }}
                onClose={() => setIntvMenuOpen(false)}
              />
            )}
            {open.interventions && (
              interventions.length === 0 ? (
                <div className={styles.emptyCard}>No interventions linked yet.</div>
              ) : (
                <GoalLinkedInterventionsList
                  interventions={interventions}
                  canEdit={canEdit && !consolidated}
                  platformUsers={platformUsers}
                  patient={patient}
                  onOpen={onOpenIntervention}
                  onPriorityMenu={consolidated ? undefined : setPriorityMenu}
                  onAssigneeChange={consolidated ? undefined : handleAssigneeChange}
                  onStatusMenu={consolidated ? undefined : setLinkedStatusMenu}
                  onDueDateChange={consolidated ? undefined : handleDueDateChange}
                  onRecurrenceChange={consolidated ? undefined : handleRecurrenceChange}
                  onRowMenu={consolidated ? undefined : (m) => setRowMenu({ ...m, kind: 'intv-menu' })}
                />
              )
            )}
          </section>
        )}

        {(!consolidated || barriers.length > 0) && (
          <section className={styles.accSection}>
            <AccordionHead
              title="Barriers"
              open={open.barriers}
              onToggle={() => toggle('barriers')}
              canEdit={canEdit && !consolidated}
              addTooltip="Add Barriers"
              onAdd={() => expandAnd('barriers', () => setAddingBarrier(v => !v))}
              linkRef={barrierLinkRef}
              linkTooltip="Link existing barrier"
              linkMenuOpen={barrierLinkMenuOpen}
              onLinkExisting={() => expandAnd('barriers', () => setBarrierLinkMenuOpen(v => !v))}
            />
            {barrierLinkMenuOpen && !consolidated && (
              <LinkItemsToGoalDrawer
                title="Link Barrier to Goal"
                items={barrierLinkCandidates}
                searchPlaceholder="Search Barrier"
                emptyAllLinkedLabel="Every barrier on this plan is already linked to this goal."
                emptyNoMatchLabel="No barriers match that search."
                onClose={() => setBarrierLinkMenuOpen(false)}
                onLink={async (ids) => {
                  for (const id of ids) {
                    // eslint-disable-next-line no-await-in-loop
                    await toggleBarrierLink(id, true);
                  }
                }}
              />
            )}
            {open.barriers && (
              <>
                {addingBarrier && !consolidated && (
                  <div className={styles.addRow}>
                    <Input
                      placeholder="Barrier title"
                      value={barrierTitle}
                      onChange={e => setBarrierTitle(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') submitBarrier(); }}
                      aria-label="Barrier title"
                    />
                    <Button variant="primary" size="S" onClick={submitBarrier} disabled={!barrierTitle.trim()}>Save</Button>
                  </div>
                )}
                {barriers.length === 0 ? (
                  <div className={styles.emptyCard}>No barriers linked yet.</div>
                ) : (
                  <GoalLinkedBarriersList
                    barriers={barriers}
                    canEdit={canEdit && !consolidated}
                    onOpen={onOpenBarrier}
                    onStatusMenu={consolidated ? undefined : setLinkedStatusMenu}
                    onRowMenu={consolidated ? undefined : (m) => setRowMenu({ ...m, kind: 'barrier-menu' })}
                  />
                )}
              </>
            )}
          </section>
        )}

        {(!consolidated || automations.length > 0) && (
          <section className={styles.accSection}>
            <AccordionHead
              title="Automations"
              open={open.automations}
              onToggle={() => toggle('automations')}
              canEdit={canEdit && !consolidated}
              addTooltip="Add Automations"
              onAdd={() => expandAnd('automations', () => setAddingAutomation(v => !v))}
            />
            {open.automations && (
              <>
                {addingAutomation && !consolidated && (
                  <div className={styles.addRow}>
                    <Input
                      placeholder="Automation (e.g. Notify care team on 5% deviation)"
                      value={automationTitle}
                      onChange={e => setAutomationTitle(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') submitAutomation(); }}
                      aria-label="Automation title"
                    />
                    <Button variant="primary" size="S" onClick={submitAutomation} disabled={!automationTitle.trim()}>Save</Button>
                  </div>
                )}
                {automations.length === 0 ? (
                  <div className={styles.emptyCard}>No automations set up.</div>
                ) : (
                  <div className={styles.linkedList}>
                    {automations.map(a => (
                      <div key={a.id} className={styles.linkedRow}>
                        <span className={styles.linkedIcon}><Icon name={a.icon || 'solar:bolt-linear'} size={16} color="var(--neutral-400)" /></span>
                        <span className={styles.linkedText}><span className={styles.linkedTitle}>{a.title}</span></span>
                        {canEdit && !consolidated && (
                          <span className={styles.linkedRowActions}>
                            <button type="button" className={styles.linkedRowRemove} onClick={() => deleteCarePlanAutomation(patientId, program.id, a.id)} aria-label="Remove automation">
                              <Icon name="solar:trash-bin-minimalistic-linear" size={14} color="var(--neutral-300)" />
                            </button>
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {canEdit && (
          <div ref={noteSectionRef} className={barrierStyles.noteEditor}>
            {latestGoalNote && !noteEditing ? (
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
                    <p className={styles.careNoteBody}>{latestGoalNote.detail}</p>
                    <div className={styles.careNoteMeta}>
                      <span className={styles.careNoteAuthor}>{latestGoalNote.actor || 'You'}</span>
                      <span className={styles.careNoteDot} aria-hidden="true">•</span>
                      <span className={styles.careNoteTimestamp}>{fmtStamp(latestGoalNote.createdAt)}</span>
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
                          entityType: 'goal',
                          entityId: live.id,
                          action: 'note_deleted',
                          summary: `Note on ${live.title || 'goal'} deleted`,
                          detail: latestGoalNote.detail || '',
                        });
                        setNote('');
                        setNotePlain('');
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
                    onChange={(html, extra) => {
                      setNote(typeof html === 'string' ? html : '');
                      setNotePlain(typeof extra === 'string' ? extra : (typeof html === 'string' ? html : ''));
                    }}
                    richText
                    attachment
                    rows={3}
                  />
                </section>
                {(() => {
                  const baseline = (latestGoalNote?.detail || '').trim();
                  const current = (notePlain || note).replace(/<[^>]+>/g, '').trim();
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
                          setNotePlain(baseline);
                          if (latestGoalNote) setNoteEditing(false);
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
                        {latestGoalNote ? 'Update Note' : 'Add Note'}
                      </Button>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}

        <div className={styles.activityBlock}>
          <TabStrip
            items={ACTIVITY_TABS}
          activeKey={activityTab}
          onChange={setActivityTab}
          fullWidth={false}
          size="S"
          trailing={(
            <ActionButton
              ref={filterBtnRef}
              icon="custom:filter"
              size="S"
              tooltip="Filter activity"
              active={filtersOpen || activityFilter !== 'all'}
              onClick={() => setFiltersOpen(v => !v)}
            />
          )}
        />
        {filtersOpen && (() => {
          // Toggle the filter chip below the tab strip. Single-select
          // radio popover; picking a filter narrows the timeline, and
          // the chip's ✕ clears back to "all activity".
          const OPTIONS = ACTIVITY_FILTERS.filter(f => f.key !== 'all').map(f => f.label);
          const keyByLabel = Object.fromEntries(ACTIVITY_FILTERS.map(f => [f.label, f.key]));
          const activeLabel = ACTIVITY_FILTERS.find(f => f.key === activityFilter)?.label;
          const selected = activityFilter === 'all' ? [] : (activeLabel ? [activeLabel] : []);
          return (
            <div className={styles.activityFilterBar}>
              <FilterChip
                label="Activity"
                popoverLabel="Filter activity"
                options={OPTIONS}
                selected={selected}
                singleSelect
                size="S"
                onChange={(next) => {
                  const pick = Array.isArray(next) ? next[0] : null;
                  setActivityFilter(pick ? (keyByLabel[pick] || 'all') : 'all');
                }}
              />
            </div>
          );
        })()}
        <div className={styles.activityLogPad}>
          <ActivityLog
            entries={activity}
            emptyLabel="No activity yet."
          />
        </div>
        </div>
      </div>

      {moreMenu && (
        <MenuPopover
          anchorRect={moreMenu}
          width={160}
          ariaLabel="Goal actions"
          items={[
            { key: 'rename', icon: 'solar:pen-linear', label: 'Rename', disabled: !canEdit },
            { key: 'delete', icon: 'solar:trash-bin-trash-linear', label: 'Remove', danger: true, disabled: !canEdit },
          ]}
          onSelect={(k) => {
            setMoreMenu(null);
            if (k === 'rename') { setTitleDraft(live.title); setEditingTitle(true); }
            if (k === 'delete') setConfirm({ kind: 'goal' });
          }}
          onClose={() => setMoreMenu(null)}
        />
      )}


      {intvOpen && intvSelectedKind && (() => {
        // Same routing as the plan-level "+ Intervention" flow so the
        // user gets the full kind-specific editor (Send Form, Patient
        // Education, Measure Vital) or the shared task drawer for
        // Patient / Internal Task. The new intervention is pre-linked
        // to this goal.
        const isTaskKind = intvSelectedKind === 'patient-task' || intvSelectedKind === 'internal-task';
        const closeAll = () => { setIntvOpen(false); setIntvSelectedKind(null); };
        if (isTaskKind) {
          return (
            <AddTaskDrawer
              taskKind={intvSelectedKind}
              initialMember={patientName}
              initialAssignedTo={intvSelectedKind === 'internal-task' ? '' : patientName}
              showScheduleFields
              availableGoals={slice?.goals || []}
              initialLinkedGoalIds={[live.id]}
              onClose={closeAll}
              onTaskCreated={async (t) => {
                const record = buildInterventionRecordFromConfig(
                  intvSelectedKind,
                  { title: t?.name || '', taskId: t?.id, goalIds: [live.id] },
                  { preLinkedGoalId: live.id },
                );
                await savePatientCarePlanIntervention(patientId, program, record);
                closeAll();
              }}
            />
          );
        }
        const Editor = INTERVENTION_EDITORS[intvSelectedKind];
        if (!Editor) return null;
        return (
          <Editor
            kind={intvSelectedKind}
            intervention={null}
            linkToGoalsAllowed
            availableGoals={slice?.goals || []}
            linkedGoalIds={[live.id]}
            memberName={patientName}
            onClose={closeAll}
            onSave={async (config) => {
              const record = buildInterventionRecordFromConfig(
                intvSelectedKind,
                { ...config, goalIds: config?.goalIds?.length ? config.goalIds : [live.id] },
                { preLinkedGoalId: live.id },
              );
              await savePatientCarePlanIntervention(patientId, program, record);
              closeAll();
            }}
          />
        );
      })()}

      {priorityMenu && (
        <MenuPopover
          anchorRect={priorityMenu.rect}
          align="left"
          width={160}
          ariaLabel="Change priority"
          items={PRIORITIES.map(p => ({
            key: p,
            label: p.charAt(0).toUpperCase() + p.slice(1),
            iconElement: <PriorityIcon priority={p} size={16} />,
          }))}
          onSelect={changePriority}
          onClose={() => setPriorityMenu(null)}
        />
      )}

      {linkedStatusMenu && (
        <MenuPopover
          anchorRect={linkedStatusMenu.rect}
          align="left"
          width={160}
          ariaLabel="Change status"
          items={GBI_STATUSES.map(s => ({ key: s, label: s }))}
          onSelect={changeLinkedItemStatus}
          onClose={() => setLinkedStatusMenu(null)}
        />
      )}

      {rowMenu && (() => {
        const isBarrier = rowMenu.kind === 'barrier-menu';
        const label = isBarrier ? 'barrier' : 'intervention';
        return (
          <MenuPopover
            anchorRect={rowMenu.rect}
            width={220}
            ariaLabel={`${isBarrier ? 'Barrier' : 'Intervention'} actions`}
            items={[
              {
                key: 'open',
                icon: 'solar:arrow-right-up-linear',
                label: `Open ${label}`,
                disabled: isBarrier ? !onOpenBarrier : !onOpenIntervention,
              },
              // Unlink moved off the row rail and into this menu so
              // both intervention + barrier rows carry the same
              // primary controls (priority / assignee / status) and
              // hide the destructive actions under the overflow.
              {
                key: 'unlink',
                icon: 'solar:link-broken-minimalistic-linear',
                label: `Unlink from this goal`,
                disabled: !canEdit,
              },
              {
                key: 'delete',
                icon: 'solar:trash-bin-trash-linear',
                label: `Delete ${label}`,
                danger: true,
                disabled: !canEdit,
              },
            ]}
            onSelect={(k) => {
              const item = rowMenu.item;
              const rowKind = rowMenu.kind;
              setRowMenu(null);
              if (k === 'open') {
                if (isBarrier) onOpenBarrier?.(item);
                else onOpenIntervention?.(item);
              }
              /* Unlink routing mirrors what the row Unlink button used
                 to do: intervention flips its goalId off this goal
                 immediately (single-owner), barrier goes through the
                 warning ConfirmDialog because it can still stay linked
                 to other goals. */
              else if (k === 'unlink') {
                if (rowKind === 'barrier-menu') {
                  setConfirm({ kind: 'unlink-barrier', item });
                } else {
                  toggleInterventionLink(item.id, false);
                }
              }
              /* Delete opens the scope picker below — the user chooses
                 whether the removal applies to this goal on this
                 template, every linked template, or the whole plan.
                 Same picker handles both interventions and barriers;
                 `deleteKind` routes to the right store action. */
              else if (k === 'delete') {
                setConfirm({
                  kind: 'gbi-delete-scope',
                  deleteKind: rowKind === 'barrier-menu' ? 'barrier' : 'intervention',
                  id: item.id,
                  name: item.title,
                });
              }
            }}
            onClose={() => setRowMenu(null)}
          />
        );
      })()}

      {confirm?.kind === 'goal' && (() => {
        // Same choice the goals table offers: remove the linked items too, or
        // only the goal.
        const cascade = goalCascade(slice, live.id);
        const remove = async (withLinked) => {
          const took = withLinked && (cascade.interventions.length + cascade.barriers.length);
          await deletePatientCarePlanGoal(patientId, program.id, live.id, { cascade: withLinked });
          setConfirm(null);
          onClose?.();
          showToast?.(took ? 'Goal & linked items removed successfully' : 'Goal removed successfully');
        };
        return (
          <RemoveGoalDialog
            goalTitle={live.title}
            cascade={cascade}
            onRemoveAll={() => remove(true)}
            onRemoveGoalOnly={() => remove(false)}
            onCancel={() => setConfirm(null)}
          />
        );
      })()}

      {confirm?.kind === 'intv' && (
        <ConfirmDialog
          variant="error"
          title={`Remove "${confirm.name}"?`}
          description="This removes the intervention from the patient's care plan."
          confirmLabel="Remove"
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            await deletePatientCarePlanIntervention(patientId, program.id, confirm.id);
            setConfirm(null);
          }}
        />
      )}

      {confirm?.kind === 'gbi-delete-scope' && (
        <IntvDeleteScopePicker
          name={confirm.name}
          kindLabel={confirm.deleteKind === 'barrier' ? 'barrier' : 'intervention'}
          onCancel={() => setConfirm(null)}
          onConfirm={async (scope) => {
            /* Backend for template-scoped and global deletes is not
               wired yet — every scope hits the plain delete store
               action for its kind. The toast makes the user's chosen
               scope visible so QA can verify the picker fires
               end-to-end. */
            if (confirm.deleteKind === 'barrier') {
              await deletePatientCarePlanBarrier(patientId, program.id, confirm.id);
            } else {
              await deletePatientCarePlanIntervention(patientId, program.id, confirm.id);
            }
            const scopeLabel = SCOPE_LABEL[scope] || 'this goal';
            showToast?.(`Removed "${confirm.name}" from ${scopeLabel}`);
            setConfirm(null);
          }}
        />
      )}

      {confirm?.kind === 'unlink-barrier' && (
        <ConfirmDialog
          icon="solar:danger-triangle-linear"
          iconColor="var(--status-warning)"
          title={`Unlink from "${live.title}"?`}
          description="This removes the barrier from this goal. It stays linked to any other goals it's attached to."
          confirmLabel="Unlink"
          cancelLabel="Cancel"
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            const item = confirm.item;
            setConfirm(null);
            await toggleBarrierLink(item.id, false);
            showToast?.(`Unlinked from ${live.title}`);
          }}
        />
      )}

      {confirm?.kind === 'note' && (
        <ConfirmDialog
          variant="error"
          title="Delete this note?"
          description="The note will be removed from this goal's activity."
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
