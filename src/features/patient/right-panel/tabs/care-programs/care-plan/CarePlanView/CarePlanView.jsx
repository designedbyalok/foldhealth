import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../../../../../../components/Icon/Icon';
import { AddIconMinimalist } from '../../../../../../../components/Icon/AddIconMinimalist';
import { ActionButton } from '../../../../../../../components/ActionButton/ActionButton';
import { ActivityLog } from '../../../../../../../components/ActivityLog/ActivityLog';
import { Button } from '../../../../../../../components/Button/Button';
import { Input } from '../../../../../../../components/Input/Input';
import { Textarea } from '../../../../../../../components/Textarea/Textarea';
import { Drawer } from '../../../../../../../components/Drawer/Drawer';
import { MenuPopover } from '../../../../../../../components/MenuPopover/MenuPopover';
import { SelectAssigneeModal } from '../../../../../../../components/SelectAssigneeModal/SelectAssigneeModal';
import { PriorityIcon } from '../../../../../../../components/PriorityIcon/PriorityIcon';
import { ConfirmDialog } from '../../../../../../../components/ConfirmDialog/ConfirmDialog';
import { goalCascade } from '../lib/carePlanGoalCascade';
import { RemoveGoalDialog } from '../drawers/RemoveGoalDialog';
import { Select } from '../../../../../../../components/Select/Select';
import { FilterChip } from '../../../../../../../components/FilterChip/FilterChip';
import { useAppStore } from '../../../../../../../store/useAppStore';
import { AddGoalsDrawer } from '../../../../../../settings/care-plan-library/goals/AddGoalsDrawer/AddGoalsDrawer';
import { AddBarriersDrawer } from '../../../../../../settings/care-plan-library/barriers/AddBarriersDrawer/AddBarriersDrawer';
import { BarrierDrawer } from '../../../../../../settings/care-plan-library/barriers/BarrierDrawer/BarrierDrawer';
import { BarrierDetailDrawer } from '../drawers/BarrierDetailDrawer/BarrierDetailDrawer';
import { AddInterventionDrawer } from '../drawers/AddInterventionDrawer/AddInterventionDrawer';
import { INTERVENTION_EDITORS } from '../../../../../../settings/care-plan-library/interventions';
import { AddTaskDrawer } from '../../../../../../tasks/AddTaskDrawer';
import {
  CARE_PLAN_INTERVENTION_MENU,
  buildInterventionRecordFromConfig,
} from '../lib/carePlanInterventionMenu';
import { CarePlanShareDrawer } from '../drawers/CarePlanShareDrawer/CarePlanShareDrawer';
import { CarePlanHistoryDrawer } from '../drawers/CarePlanHistoryDrawer/CarePlanHistoryDrawer';
import { CarePlanVersionsDrawer } from '../drawers/CarePlanVersionsDrawer/CarePlanVersionsDrawer';
import { CarePlanLinkDrawer } from '../drawers/CarePlanLinkDrawer/CarePlanLinkDrawer';
import { CarePlanTrendsDrawer } from '../drawers/CarePlanTrendsDrawer/CarePlanTrendsDrawer';
import { GoalPreviewDrawer } from '../drawers/GoalPreviewDrawer/GoalPreviewDrawer';
import { InterventionPreviewDrawer } from '../drawers/InterventionPreviewDrawer/InterventionPreviewDrawer';
import { deriveGoalTableFields } from '../lib/goalMetrics';
import { CarePlanGoalsTable } from '../tables/CarePlanGoalsTable';
import { CarePlanInterventionsTable } from '../tables/CarePlanInterventionsTable';
import { CarePlanBarriersTable } from '../tables/CarePlanBarriersTable';
import { GBI_STATUS_TONE } from '../tables/carePlanTableShared';
import { RingEmptyState } from '../../../../../../../components/RingEmptyState/RingEmptyState';
import { SimpleTableSkeleton } from '../../../../../../../components/SimpleTableSkeleton/SimpleTableSkeleton';
import { DownChevronIcon } from '../../../../../../../components/Icon/DownChevronIcon';
import { BulkBar } from '../../../../../../../components/BulkBar/BulkBar';
import { Badge } from '../../../../../../../components/Badge/Badge';
import { ApplyTemplatesDrawer } from '../drawers/ApplyTemplatesDrawer/ApplyTemplatesDrawer';
import { CarePlanDuplicateGroup } from '../DuplicateFlag/CarePlanDuplicateGroup';
import { AppliedTemplateStrip } from './AppliedTemplateStrip';
import {
  barrierPayloadFromTemplateEntry,
  goalPayloadFromTemplateEntry,
  interventionPayloadFromTemplateEntry,
} from '../lib/carePlanTemplateApply';
import styles from './CarePlanView.module.css';

const EMPTY_ARR = [];

// The statuses a goal or intervention can move through. Kept flat and shared so
// the pill menu and the intervention drawer offer the same vocabulary.
const GBI_STATUSES = ['Not Started', 'In Progress', 'On Hold', 'Met', 'Not Met'];
const PRIORITIES = ['high', 'medium', 'low'];
// Capitalized labels for the priority filter chip (values compare case-insensitively).
const PRIORITY_LABELS = ['High', 'Medium', 'Low'];

/** Collapsible GBI section header: title · divider · add action · [optional trailing end]. */
function GbiSectionHead({ title, count, open, onToggle, addButton, trailingEnd }) {
  return (
    <div className={`${styles.sectionHead} ${styles.gbiSectionHead}`}>
      <SectionTitle label={title} count={count} open={open} onToggle={onToggle} />
      <span className={styles.sectionActionDivider} aria-hidden="true" />
      {addButton}
      {trailingEnd ? <div className={styles.gbiSectionHeadEnd}>{trailingEnd}</div> : null}
    </div>
  );
}
function SectionTitle({ label, count, open, onToggle }) {
  return (
    <button type="button" className={styles.sectionToggle} onClick={onToggle} aria-expanded={open}>
      <DownChevronIcon
        size={16}
        color="var(--neutral-400)"
        className={`${styles.sectionChevron} ${open ? '' : styles.sectionChevronClosed}`}
      />
      <span className={styles.sectionTitle}>{label}</span>
      {count > 0 ? <span className={styles.sectionCount}>{count}</span> : null}
    </button>
  );
}

/** Per-section dashed empty card (Figma SNP-Story 8430:288488). */
function SectionEmptyState({ icon, label, onAdd }) {
  return (
    <div className={styles.sectionEmpty}>
      <RingEmptyState icon={icon} label={label} iconSize={31} />
      <div className={styles.sectionEmptyActions}>
        <Button
          variant="tertiary"
          size="L"
          leadingIconElement={<AddIconMinimalist size={16} />}
          onClick={onAdd}
        >
          Add New
        </Button>
      </div>
    </div>
  );
}

export function CarePlanView({ patientId, program }) {
  const fetchPatientCarePlan = useAppStore(s => s.fetchPatientCarePlan);
  const savePatientCarePlanGoal = useAppStore(s => s.savePatientCarePlanGoal);
  const deletePatientCarePlanGoal = useAppStore(s => s.deletePatientCarePlanGoal);
  const savePatientCarePlanIntervention = useAppStore(s => s.savePatientCarePlanIntervention);
  const deletePatientCarePlanIntervention = useAppStore(s => s.deletePatientCarePlanIntervention);
  const savePatientCarePlanBarrier = useAppStore(s => s.savePatientCarePlanBarrier);
  const deletePatientCarePlanBarrier = useAppStore(s => s.deletePatientCarePlanBarrier);
  const refreshCarePlanDuplicates = useAppStore(s => s.refreshCarePlanDuplicates);
  const dismissCarePlanDuplicate = useAppStore(s => s.dismissCarePlanDuplicate);
  const savePatientCarePlanAsTemplate = useAppStore(s => s.savePatientCarePlanAsTemplate);
  const signCarePlan = useAppStore(s => s.signCarePlan);
  const addCarePlanNote = useAppStore(s => s.addCarePlanNote);
  const logCarePlanAudit = useAppStore(s => s.logCarePlanAudit);
  const fetchCarePlanAudit = useAppStore(s => s.fetchCarePlanAudit);
  const showToast = useAppStore(s => s.showToast);
  // A patient loaded via a worklist deep link may live in a member slice
  // (hcc / awv / ccm / snp / hedis) rather than in the plain patients array,
  // so fall through every slice the outer PatientDetailView also checks.
  const patientName = useAppStore(s => {
    const match = m => m && (m.id === patientId || String(m.memberId) === String(patientId));
    const src = (s.patients || []).find(match)
      || (s.hccMembers || []).find(match)
      || (s.awvMembers || []).find(match)
      || (s.ccmWorklistMembers || []).find(match)
      || (s.snpWorklistMembers || []).find(match)
      || (s.hedisMembers || []).find(match)
      || (s.allPatients || []).find(match);
    return src?.name;
  });
  const platformUsers = useAppStore(s => s.platformUsers);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  useEffect(() => { fetchPlatformUsers?.(); }, [fetchPlatformUsers]);
  const carePlanShareRequest = useAppStore(s => s.carePlanShareRequest);
  const clearCarePlanShareRequest = useAppStore(s => s.clearCarePlanShareRequest);
  // Bulk-select mode is toggled from the program-detail content header.
  const bulkMode = useAppStore(s => s.carePlanBulkMode);
  const setCarePlanBulkMode = useAppStore(s => s.setCarePlanBulkMode);
  const carePlanPanelRequest = useAppStore(s => s.carePlanPanelRequest);
  const clearCarePlanPanelRequest = useAppStore(s => s.clearCarePlanPanelRequest);
  const carePlanTemplates = useAppStore(s => s.carePlanTemplates);
  const carePlanGoals = useAppStore(s => s.carePlanGoals);
  const fetchCarePlanLibrary = useAppStore(s => s.fetchCarePlanLibrary);
  const libraryGoals = useAppStore(s => s.carePlanGoals);
  const repairCarePlanGoalLinks = useAppStore(s => s.repairCarePlanGoalLinks);
  const syncAppliedCarePlanTemplates = useAppStore(s => s.syncAppliedCarePlanTemplates);
  const applyPatientCarePlanTemplates = useAppStore(s => s.applyPatientCarePlanTemplates);
  const savePatientCarePlanConditions = useAppStore(s => s.savePatientCarePlanConditions);

  const key = patientId && program ? `${patientId}::${program.id}` : null;
  const live = useAppStore(s => (key ? s.patientCarePlans[key] : null));
  const auditAll = useAppStore(s => (key ? s.patientCarePlanAudit[key] : null)) || [];
  useEffect(() => {
    if (patientId && program?.id) fetchCarePlanAudit?.(patientId, program.id);
  }, [patientId, program?.id, fetchCarePlanAudit]);
  // Latest plan-level note (Figma 2562:60104): sorted by createdAt desc, we
  // show only the newest one on the plan surface; every prior note stays in
  // the audit log as the change history.
  const planNoteHistory = useMemo(() => (
    auditAll
      .filter(a => a.action === 'note' && (a.entityType === 'plan' || !a.entityType))
      .sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt))
  ), [auditAll]);
  // If the most-recent plan-note lifecycle event is a "clear", we suppress
  // the card until the user adds a new note. The full history — including
  // every past note and every clear — stays in the audit log.
  const latestClearAt = useMemo(() => {
    const clears = auditAll
      .filter(a => a.action === 'note_cleared' && (a.entityType === 'plan' || !a.entityType))
      .sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt));
    return clears[0]?.createdAt || null;
  }, [auditAll]);
  const rawLatestNote = planNoteHistory[0] || null;
  const latestPlanNote = (rawLatestNote && latestClearAt && new Date(latestClearAt) > new Date(rawLatestNote.createdAt))
    ? null
    : rawLatestNote;
  // Shape care-plan notes for the shared ActivityLog primitive — the
  // "comment" variant renders the author + timestamp meta line and a
  // pre-wrap body, which matches the Figma note-timeline treatment.
  const noteTimelineEntries = useMemo(() => (
    planNoteHistory.map(a => {
      const created = a.createdAt ? new Date(a.createdAt) : null;
      return {
        id: a.id,
        t: 'comment',
        date: created ? created.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null,
        time: created ? created.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null,
        by: a.actor || 'Unknown',
        title: 'Added a Note',
        commentBody: a.detail || '',
      };
    })
  ), [planNoteHistory]);
  const duplicateFlags = useAppStore(s => (key ? s.carePlanDuplicateFlags[key] : null)) || EMPTY_ARR;
  // First-load skeleton: true while the initial fetch is in flight (before the
  // plan resolves), false once loaded.
  const carePlanLoading = useAppStore(s => (key ? !!s.patientCarePlanLoading[key] : false));

  const fetchCarePlanLinks = useAppStore(s => s.fetchCarePlanLinks);
  const [linkOwner, setLinkOwner] = useState(null); // null | { kind, item }
  // Linked-items preview data (Figma SNP-Story 2632:112808). A goal links its
  // interventions/barriers/automations (by goalId); a child row links its goal.
  const programBadge = program?.name ? [program.name] : (program?.code ? [program.code] : []);
  // A barrier is many-to-many with goals via `goalIds` (join table); fall
  // back to the legacy `goalId` column when the array is empty so
  // pre-migration data still resolves. Interventions and automations are
  // still 1:1 with a goal.
  const barrierGoalIds = (b) => {
    if (Array.isArray(b.goalIds) && b.goalIds.length > 0) return b.goalIds;
    return b.goalId ? [b.goalId] : [];
  };
  const linkedForGoal = (g) => ({
    programs: programBadge,
    interventions: (live?.interventions || []).filter(i => i.goalId === g.id).map(i => ({ id: i.id, icon: i.icon, title: i.title })),
    barriers: (live?.barriers || []).filter(b => barrierGoalIds(b).includes(g.id)).map(b => ({ id: b.id, title: b.title })),
    automations: (live?.automations || []).filter(a => a.goalId === g.id).map(a => ({ id: a.id, title: a.title })),
  });
  const linkedForChild = (item) => {
    // A barrier can be linked to several goals; interventions /
    // automations remain single-goal.
    const parentGoalIds = Array.isArray(item.goalIds) && item.goalIds.length > 0
      ? item.goalIds
      : (item.goalId ? [item.goalId] : []);
    return {
      programs: programBadge,
      goals: (live?.goals || [])
        .filter(g => parentGoalIds.includes(g.id))
        .map(g => ({ id: g.id, title: g.title, icon: g.icon })),
    };
  };

  useEffect(() => {
    if (patientId && program?.id) {
      fetchPatientCarePlan(patientId, program.id);
      fetchCarePlanLinks(patientId, program.id);
      // Surface duplicates already sitting on this (and other) plans on load.
      refreshCarePlanDuplicates(patientId, program);
    }
  }, [patientId, program?.id, fetchPatientCarePlan, fetchCarePlanLinks, refreshCarePlanDuplicates]); // eslint-disable-line react-hooks/exhaustive-deps -- program object is stable by id

  useEffect(() => { fetchCarePlanLibrary?.(); }, [fetchCarePlanLibrary]);

  // Reconcile the plan with what it says it carries, once both it and the
  // library are loaded: first bring in the content of templates applied before
  // apply carried it, then reattach any loose interventions and barriers.
  useEffect(() => {
    if (!patientId || !program?.id || !live?.plan || !libraryGoals?.length) return;
    (async () => {
      await syncAppliedCarePlanTemplates(patientId, program);
      await repairCarePlanGoalLinks(patientId, program);
    })();
  }, [patientId, program?.id, live?.plan?.id, libraryGoals?.length]); // eslint-disable-line react-hooks/exhaustive-deps -- runs once per plan, guarded in the store


  useEffect(() => {
    if (!carePlanPanelRequest) return;
    if (carePlanPanelRequest === 'versions') setVersionsOpen(true);
    else if (carePlanPanelRequest === 'template') { setTemplateName(''); setTemplateOpen(true); }
    else if (carePlanPanelRequest === 'templates') setTemplatesDrawerOpen(true);
    else if (carePlanPanelRequest === 'history') setHistoryOpen(true);
    else if (carePlanPanelRequest === 'filter') setFiltersOpen(true);
    else if (carePlanPanelRequest === 'note') { openNoteDrawer(); }
    else if (carePlanPanelRequest === 'sign') { setSignNote(''); setSignOpen(true); }
    else if (carePlanPanelRequest === 'scan-duplicates') { scanForDuplicates(); }
    clearCarePlanPanelRequest();
  }, [carePlanPanelRequest, clearCarePlanPanelRequest]); // eslint-disable-line react-hooks/exhaustive-deps -- request handlers are stable

  // A share request that was never opened/closed (e.g. the program was closed
  // with the flag still set) must not linger and auto-open the drawer next time.
  useEffect(() => () => clearCarePlanShareRequest(), [clearCarePlanShareRequest]);

  // No persisted plan yet — GBI lists start empty (Figma SNP-Story 8430:288488)
  // instead of the old local mock preview.
  const usingMock = !live;
  const measurements = live?.measurements || [];
  const data = useMemo(() => (live ? {
    // Plan-level problems are user-managed, so every chip gets a remove control.
    conditions: (live.plan.conditions || []).map(c => ({ ...c, removable: true })),
    conditionTotal: live.plan.conditionTotal,
    goals: live.goals.map(g => ({ ...g, ...deriveGoalTableFields(g, measurements) })),
    interventions: live.interventions,
    barriers: live.barriers || [],
  } : {
    conditions: [],
    conditionTotal: 0,
    goals: [],
    interventions: [],
    barriers: [],
  }), [live, measurements]);

  const [problemOpen, setProblemOpen] = useState(false);
  const [problemText, setProblemText] = useState('');
  const [trendsOpen, setTrendsOpen] = useState(false);
  // Collapsible GBI sections (chevron in each section header).
  // Remember which GBI sections are collapsed across visits (per-device UI pref).
  const [openSections, setOpenSections] = useState(() => {
    const fallback = { goals: true, interventions: true, barriers: true, careNote: true };
    try {
      const saved = JSON.parse(localStorage.getItem('carePlanOpenSections') || 'null');
      return saved && typeof saved === 'object' ? { ...fallback, ...saved } : fallback;
    } catch { return fallback; }
  });
  useEffect(() => {
    try { localStorage.setItem('carePlanOpenSections', JSON.stringify(openSections)); } catch { /* storage unavailable */ }
  }, [openSections]);
  const toggleSection = (name) => setOpenSections(s => ({ ...s, [name]: !s[name] }));
  const [statusMenu, setStatusMenu] = useState(null); // { kind, item, rect }
  const [priorityMenu, setPriorityMenu] = useState(null); // { kind, item, rect }
  const [addGoalsDrawerOpen, setAddGoalsDrawerOpen] = useState(false);
  const [addBarriersDrawerOpen, setAddBarriersDrawerOpen] = useState(false);
  const [previewGoal, setPreviewGoal] = useState(null);
  const [previewIntervention, setPreviewIntervention] = useState(null);
  const [intvDrawer, setIntvDrawer] = useState(null);  // false | { intervention }
  const [intvTypeMenuOpen, setIntvTypeMenuOpen] = useState(false);
  const [intvSpecialDrawer, setIntvSpecialDrawer] = useState(null); // null | { kind, intervention? }
  const [taskDrawerOpen, setTaskDrawerOpen] = useState(null); // null | 'patient-task' | 'internal-task'
  const intvAddRef = useRef(null);
  const [barrierDrawer, setBarrierDrawer] = useState(null); // null | { barrier }
  // Barrier preview drawer: shows goals/template linked to this barrier
  // in the current plan version, with delink + add-goal affordances.
  const [previewBarrier, setPreviewBarrier] = useState(null);
  const [templatesDrawerOpen, setTemplatesDrawerOpen] = useState(false);
  // Applied-template filter: clicking a template badge in the sticky bar
  // scopes goals / interventions / barriers to items that came from that
  // template. Click again (or another badge) to swap; the "+N more" chip
  // clears it. Null means show everything.
  const [templateFilterId, setTemplateFilterId] = useState(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null); // { kind, id, name }
  const [historyOpen, setHistoryOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [signNote, setSignNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  // Baseline the textarea against when the drawer opened so we can tell if
  // the user actually edited before offering the discard confirmation.
  const [noteBaseline, setNoteBaseline] = useState('');
  const [noteDiscardOpen, setNoteDiscardOpen] = useState(false);
  const [noteDeleteOpen, setNoteDeleteOpen] = useState(false);
  const noteDirty = noteText.trim() !== (noteBaseline || '').trim();
  const openNoteDrawer = () => {
    const seed = latestPlanNote?.detail || '';
    setNoteText(seed);
    setNoteBaseline(seed);
    setNoteOpen(true);
  };
  const closeNoteDrawer = ({ force = false } = {}) => {
    if (!force && noteDirty) { setNoteDiscardOpen(true); return; }
    setNoteOpen(false);
    setNoteText('');
    setNoteBaseline('');
  };
  // Role/status/priority filter (#39). Goals & barriers have no assignee, so the
  // assignee filter narrows only interventions; status/priority apply to all.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({ status: [], priority: [], assignee: [] });

  const setFilter = (key, vals) => setFilters(f => ({ ...f, [key]: vals }));
  const clearFilters = () => setFilters({ status: [], priority: [], assignee: [] });
  const filtersActive = filters.status.length || filters.priority.length || filters.assignee.length;

  const selectAllKind = (kind, rows, checked) => setSelected(prev => ({
    ...prev,
    [kind]: checked ? new Set(rows.map(r => r.id)) : new Set(),
  }));

  const canEdit = !!(patientId && program);

  const assigneeOptions = useMemo(
    () => [...new Set((data.interventions || []).map(i => i.assignee?.name).filter(Boolean))],
    [data.interventions],
  );
  const matchesSP = (item) =>
    (!filters.status.length || filters.status.includes(item.status)) &&
    (!filters.priority.length || filters.priority.map(p => p.toLowerCase()).includes((item.priority || '').toLowerCase()));

  // A goal/intervention/barrier "belongs" to a template when its title
  // matches one the template seeded — the apply flow dedupes by title, so
  // the same key is a reliable link back (no persistent template_id
  // column on the row). Barriers are cloned per-goal, so a barrier
  // belongs to the template when its goalId points at one of the
  // template's goals — this covers barriers added later against those
  // goals too, not just the ones the template itself seeded.
  const norm = (s) => (s || '').trim().toLowerCase();
  const templateScope = useMemo(() => {
    if (!templateFilterId) return null;
    const t = carePlanTemplates.find(x => x.id === templateFilterId);
    if (!t) return null;
    const titlesOf = (list, kind) => new Set((list || []).map(e => {
      if (kind === 'goals') {
        const lib = e?.id ? carePlanGoals.find(g => g.id === e.id) : null;
        return norm(lib?.title || e?.title || '');
      }
      return norm(e?.title || '');
    }).filter(Boolean));
    const goalTitles = titlesOf(t.goals, 'goals');
    const goalIdSet = new Set(
      data.goals.filter(g => goalTitles.has(norm(g.title))).map(g => g.id)
    );
    return {
      goalTitles,
      interventionTitles: titlesOf(t.interventions),
      barrierTitles: titlesOf(t.barriers),
      goalIdSet,
    };
  }, [templateFilterId, carePlanTemplates, carePlanGoals, data.goals]);
  const matchesTemplate = (item, kind) => {
    if (!templateScope) return true;
    if (kind === 'barriers') {
      return templateScope.goalIdSet.has(item.goalId)
        || templateScope.barrierTitles.has(norm(item.title));
    }
    const set = kind === 'goals' ? templateScope.goalTitles : templateScope.interventionTitles;
    return set.size > 0 && set.has(norm(item.title));
  };

  const filteredGoals = useMemo(() => data.goals.filter(g => matchesSP(g) && matchesTemplate(g, 'goals')), [data.goals, filters, templateScope]); // eslint-disable-line react-hooks/exhaustive-deps
  const filteredBarriers = useMemo(() => (data.barriers || []).filter(b => matchesSP(b) && matchesTemplate(b, 'barriers')), [data.barriers, filters, templateScope]); // eslint-disable-line react-hooks/exhaustive-deps
  const filteredInterventions = useMemo(
    () => data.interventions.filter(i => matchesSP(i) && matchesTemplate(i, 'interventions') && (!filters.assignee.length || filters.assignee.includes(i.assignee?.name))),
    [data.interventions, filters, templateScope], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Rollup for the summary strip: counts, status mix, avg goal progress. Reads
  // the filtered lists, so picking a template chip (or any filter) restates the
  // line for what is actually on screen rather than the whole plan.
  const planStats = useMemo(() => {
    const goals = filteredGoals, iv = filteredInterventions, br = filteredBarriers;
    const all = [...goals, ...iv, ...br];
    const avgProgress = goals.length
      ? Math.round(goals.reduce((sum, g) => sum + (Number(g.progress) || 0), 0) / goals.length)
      : 0;
    // One badge per status actually present, in the table's own order and
    // tone, rather than a hardcoded Met / In Progress / Overdue trio that hides
    // everything else on the plan.
    const counts = new Map();
    for (const item of all) {
      if (!item.status) continue;
      counts.set(item.status, (counts.get(item.status) || 0) + 1);
    }
    const statuses = Object.keys(GBI_STATUS_TONE)
      .filter(status => counts.get(status))
      .map(status => ({ status, count: counts.get(status), tone: GBI_STATUS_TONE[status] }));
    return {
      goals: goals.length,
      iv: iv.length,
      br: br.length,
      total: all.length,
      statuses,
      avgProgress,
    };
  }, [filteredGoals, filteredInterventions, filteredBarriers]);

  // Badge count: how many of a template's goals are actually on this plan, not
  // how many its library definition lists. The two differ while a template is
  // still being reconciled, or when a goal it brought was removed since.
  const templateGoalCounts = useMemo(() => {
    const planTitles = new Set(data.goals.map(g => norm(g.title)));
    const counts = new Map();
    for (const t of carePlanTemplates) {
      const titles = new Set((t.goals || []).map((e) => {
        const lib = e?.id ? carePlanGoals.find(g => g.id === e.id) : null;
        return norm(lib?.title || e?.title || '');
      }).filter(Boolean));
      counts.set(t.id, [...titles].filter(title => planTitles.has(title)).length);
    }
    return counts;
  }, [carePlanTemplates, carePlanGoals, data.goals]);
  const appliedTemplateIds = live?.plan?.appliedTemplateIds || [];
  const appliedTemplatePriorities = live?.plan?.appliedTemplatePriorities || {};
  const appliedTemplates = useMemo(() => {
    const rank = { high: 0, medium: 1, low: 2 };
    return appliedTemplateIds
      .map((id, index) => ({ id, index, template: carePlanTemplates.find(t => t.id === id) }))
      .filter(item => item.template)
      .sort((a, b) => {
        const pa = rank[(appliedTemplatePriorities[a.id] || 'medium').toLowerCase()] ?? 1;
        const pb = rank[(appliedTemplatePriorities[b.id] || 'medium').toLowerCase()] ?? 1;
        if (pa !== pb) return pa - pb;
        return a.index - b.index;
      })
      .map(item => item.template);
  }, [appliedTemplateIds, carePlanTemplates, appliedTemplatePriorities]);
  // Removing an applied template is allowed until the plan is signed. It
  // strips the template's own conditions from the plan header and drops
  // the row from `applied_template_ids` (priority key is pruned server-side
  // by setPatientCarePlanAppliedTemplates).
  const handleRemoveTemplate = async (templateId, e) => {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    if (!canEdit) return;
    if (live?.plan?.signedAt) return;
    const nextIds = appliedTemplateIds.filter(id => id !== templateId);
    if (templateFilterId === templateId) setTemplateFilterId(null);
    await applyPatientCarePlanTemplates(patientId, program, nextIds);
  };

  // Bulk selection (#7). Selection is per section, over the visible (filtered)
  // rows; a bulk status change loops the normal save path so each write audits.
  const [selected, setSelected] = useState({ goal: new Set(), intv: new Set(), barrier: new Set() });
  const [bulkMenu, setBulkMenu] = useState(null); // { rect, type }
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const selectedCount = selected.goal.size + selected.intv.size + selected.barrier.size;
  const toggleSelect = (kind, id) => setSelected(prev => {
    const next = new Set(prev[kind]);
    if (next.has(id)) next.delete(id); else next.add(id);
    return { ...prev, [kind]: next };
  });
  const clearSelection = () => setSelected({ goal: new Set(), intv: new Set(), barrier: new Set() });

  // Leaving bulk mode drops any pending selection; unmounting resets the shared
  // flag so bulk mode never persists across care plans.
  useEffect(() => { if (!bulkMode) setSelected({ goal: new Set(), intv: new Set(), barrier: new Set() }); }, [bulkMode]);
  useEffect(() => () => setCarePlanBulkMode(false), [setCarePlanBulkMode]);

  const bulkSetStatus = async (status) => {
    setBulkMenu(null);
    const g = filteredGoals.filter(x => selected.goal.has(x.id));
    const iv = filteredInterventions.filter(x => selected.intv.has(x.id));
    const br = filteredBarriers.filter(x => selected.barrier.has(x.id));
    for (const x of g) await savePatientCarePlanGoal(patientId, program, { ...x, status }, x.id);
    for (const x of iv) await savePatientCarePlanIntervention(patientId, program, { ...x, status }, x.id);
    for (const x of br) await savePatientCarePlanBarrier(patientId, program, { ...x, status }, x.id);
    const n = g.length + iv.length + br.length;
    clearSelection();
    if (n) showToast(`Updated ${n} item${n === 1 ? '' : 's'} to "${status}"`);
  };

  const bulkSetPriority = async (priority) => {
    setBulkMenu(null);
    const g = filteredGoals.filter(x => selected.goal.has(x.id));
    const iv = filteredInterventions.filter(x => selected.intv.has(x.id));
    const br = filteredBarriers.filter(x => selected.barrier.has(x.id));
    for (const x of g) await savePatientCarePlanGoal(patientId, program, { ...x, priority }, x.id);
    for (const x of iv) await savePatientCarePlanIntervention(patientId, program, { ...x, priority }, x.id);
    for (const x of br) await savePatientCarePlanBarrier(patientId, program, { ...x, priority }, x.id);
    const n = g.length + iv.length + br.length;
    clearSelection();
    if (n) showToast(`Set ${n} item${n === 1 ? '' : 's'} to ${priority.charAt(0).toUpperCase() + priority.slice(1)} priority`);
  };

  // Bulk assign applies to selected interventions only (goals/barriers have no assignee).
  const bulkAssign = async (user) => {
    setBulkAssignOpen(false);
    const iv = filteredInterventions.filter(x => selected.intv.has(x.id));
    if (!iv.length) { showToast('Select one or more interventions to assign'); return; }
    for (const x of iv) await savePatientCarePlanIntervention(patientId, program, { ...x, assignee: { name: user.name, initials: user.initials } }, x.id);
    clearSelection();
    showToast(`Assigned ${iv.length} intervention${iv.length === 1 ? '' : 's'} to ${user.name}`);
  };

  // Re-insert a removed goal/intervention/barrier (undo). Drops the old id so it
  // saves as a fresh row; derived fields are ignored by the row mappers.
  const restoreGbi = ({ kind, item }) => {
    const { id, ...values } = item; // eslint-disable-line no-unused-vars
    if (kind === 'goal') return savePatientCarePlanGoal(patientId, program, values);
    if (kind === 'barrier') return savePatientCarePlanBarrier(patientId, program, values);
    return savePatientCarePlanIntervention(patientId, program, values);
  };
  const undoAction = (removed) => ({
    label: 'Undo',
    onClick: async () => {
      for (const r of removed) await restoreGbi(r);
      refreshCarePlanDuplicates(patientId, program);
    },
  });

  const bulkDelete = async () => {
    setBulkDeleteOpen(false);
    const g = filteredGoals.filter(x => selected.goal.has(x.id));
    const iv = filteredInterventions.filter(x => selected.intv.has(x.id));
    const br = filteredBarriers.filter(x => selected.barrier.has(x.id));
    for (const x of g) await deletePatientCarePlanGoal(patientId, program.id, x.id);
    for (const x of iv) await deletePatientCarePlanIntervention(patientId, program.id, x.id);
    for (const x of br) await deletePatientCarePlanBarrier(patientId, program.id, x.id);
    const n = g.length + iv.length + br.length;
    clearSelection();
    if (n) {
      const removed = [
        ...g.map(item => ({ kind: 'goal', item })),
        ...iv.map(item => ({ kind: 'intervention', item })),
        ...br.map(item => ({ kind: 'barrier', item })),
      ];
      showToast(`Removed ${n} item${n === 1 ? '' : 's'}`, { action: undoAction(removed), duration: 6000 });
      refreshCarePlanDuplicates(patientId, program);
    }
  };

  const doSign = async () => {
    setSignOpen(false);
    const v = await signCarePlan(patientId, program, signNote.trim());
    setSignNote('');
    if (v) showToast('Care plan signed');
  };
  const doClearCareNote = async () => {
    setNoteDeleteOpen(false);
    if (!canEdit || !latestPlanNote) return;
    // Log a "cleared" event instead of deleting the row so every past note
    // stays in the audit log; the card derivation just skips when the most
    // recent lifecycle event is a clear.
    await logCarePlanAudit(patientId, program, {
      entityType: 'plan',
      action: 'note_cleared',
      summary: 'Care note removed',
      detail: latestPlanNote.detail || '',
    });
    showToast?.('Care note removed');
  };
  const doAddNote = async () => {
    const body = noteText.trim();
    if (!body) return;
    setNoteOpen(false);
    setNoteText('');
    setNoteBaseline('');
    await addCarePlanNote(patientId, program, body);
  };
  // The drawer is driven entirely by the store flag — the toolbar button and
  // the step header (a separate component) both set it, and closing clears it.
  // A mock plan can still be previewed/downloaded; only Share (which persists
  // real ids) is gated to a saved plan.
  const shareOpen = !!carePlanShareRequest;

  const changeStatus = (status) => {
    const { kind, item } = statusMenu;
    setStatusMenu(null);
    if (kind === 'goal') savePatientCarePlanGoal(patientId, program, { ...item, status }, item.id);
    else if (kind === 'barrier') savePatientCarePlanBarrier(patientId, program, { ...item, status }, item.id);
    else savePatientCarePlanIntervention(patientId, program, { ...item, status }, item.id);
  };

  const changePriority = (priority) => {
    const { kind, item } = priorityMenu;
    setPriorityMenu(null);
    if (kind === 'goal') savePatientCarePlanGoal(patientId, program, { ...item, priority }, item.id);
    else if (kind === 'barrier') savePatientCarePlanBarrier(patientId, program, { ...item, priority }, item.id);
    else savePatientCarePlanIntervention(patientId, program, { ...item, priority }, item.id);
  };

  const renameBarrier = (barrier, title) => savePatientCarePlanBarrier(patientId, program, { ...barrier, title }, barrier.id);

  // A picked row is the whole library goal, so a goal added here carries the
  // same definition (measure, target, duration) and the same linked items as
  // one arriving through a template.
  const handleAddGoalsFromPicker = async (picked) => {
    setAddGoalsDrawerOpen(false);
    if (!picked?.length) return;
    const norm = v => (v || '').trim().toLowerCase();
    const existingTitles = new Set(data.goals.map(g => norm(g.title)));
    const existingIntvTitles = new Set((data.interventions || []).map(i => norm(i.title)));
    const existingBarrierTitles = new Set((data.barriers || []).map(b => norm(b.title)));
    let added = 0;
    let linked = 0;
    for (const g of picked) {
      const titleKey = norm(g.title);
      if (existingTitles.has(titleKey)) continue;
      const goal = await savePatientCarePlanGoal(
        patientId, program,
        goalPayloadFromTemplateEntry({ id: g.id, title: g.title, subtitle: g.detail }, [g]),
      );
      if (!goal) continue;
      added += 1;
      existingTitles.add(titleKey);
      for (const link of g.interventions || []) {
        const linkKey = norm(link.title);
        if (!linkKey) continue;
        if (link.kind === 'barrier') {
          if (existingBarrierTitles.has(linkKey)) continue;
          const saved = await savePatientCarePlanBarrier(
            patientId, program, barrierPayloadFromTemplateEntry(link, [goal.id]),
          );
          if (saved) { existingBarrierTitles.add(linkKey); linked += 1; }
        } else {
          if (existingIntvTitles.has(linkKey)) continue;
          const saved = await savePatientCarePlanIntervention(
            patientId, program, interventionPayloadFromTemplateEntry(link, goal.id),
          );
          if (saved) { existingIntvTitles.add(linkKey); linked += 1; }
        }
      }
    }
    if (added) {
      showToast(linked
        ? `Added ${added} goal${added === 1 ? '' : 's'} with ${linked} linked item${linked === 1 ? '' : 's'}`
        : `Added ${added} goal${added === 1 ? '' : 's'}`);
      refreshCarePlanDuplicates(patientId, program);
    } else showToast('Selected goals are already on this plan');
  };

  const handleAddIntervention = async (values) => {
    const editingId = intvDrawer?.intervention?.id || null;
    setIntvDrawer(false);
    const saved = await savePatientCarePlanIntervention(patientId, program, values, editingId);
    if (saved) {
      showToast(`"${saved.title}" ${editingId ? 'updated' : 'added'}`);
      if (!editingId) refreshCarePlanDuplicates(patientId, program);
    }
  };

  const openInterventionTypeMenu = () => {
    if (!canEdit) return;
    setIntvTypeMenuOpen(v => !v);
  };

  const saveInterventionFromConfig = async (kind, config, editingId = null) => {
    const record = buildInterventionRecordFromConfig(kind, config, { editing: !!editingId });
    const saved = await savePatientCarePlanIntervention(patientId, program, record, editingId);
    if (saved) {
      showToast(`"${saved.title}" ${editingId ? 'updated' : 'added'}`);
      if (!editingId) refreshCarePlanDuplicates(patientId, program);
    }
    return saved;
  };

  const handleInterventionTypeSelect = (key) => {
    setIntvTypeMenuOpen(false);
    if (key === 'patient-task' || key === 'internal-task') setTaskDrawerOpen(key);
    else setIntvSpecialDrawer({ kind: key });
  };

  const handleAddBarriersFromPicker = async (picked, opts = {}) => {
    setAddBarriersDrawerOpen(false);
    if (!picked?.length) return;
    // Broad-scope targets need cross-plan / all-goal fan-out we haven't
    // shipped yet — the picker fires them, we acknowledge and fall back to
    // adding to this plan so nothing is lost. Real routing lands with the
    // follow-up backend work.
    const target = opts.target || 'thisPlan';
    const existingTitles = new Set((data.barriers || []).map(b => b.title.trim().toLowerCase()));
    let added = 0;
    for (const b of picked) {
      const titleKey = b.title.trim().toLowerCase();
      if (existingTitles.has(titleKey)) continue;
      const goalIdsForBarrier = target === 'thisPlanAllGoals'
        ? (data.goals || []).map(g => g.id)
        : [];
      const saved = await savePatientCarePlanBarrier(patientId, program, {
        title: b.title,
        description: b.description || '',
        status: 'Not Started',
        priority: 'medium',
        goalIds: goalIdsForBarrier,
      });
      if (saved) {
        added += 1;
        existingTitles.add(titleKey);
      }
    }
    if (added) {
      const scopeCopy = {
        thisPlan: `Added ${added} barrier${added === 1 ? '' : 's'} to this plan`,
        thisPlanAllGoals: `Added ${added} barrier${added === 1 ? '' : 's'} to every goal on this plan`,
        allPlans: `Added ${added} barrier${added === 1 ? '' : 's'} — cross-plan fan-out is pending, saved to this plan for now`,
        allPlansAllGoals: `Added ${added} barrier${added === 1 ? '' : 's'} — cross-plan fan-out is pending, saved to every goal on this plan`,
      };
      showToast(scopeCopy[target] || scopeCopy.thisPlan);
      refreshCarePlanDuplicates(patientId, program);
    } else {
      showToast('Selected barriers are already on this plan');
    }
  };

  const handleAddBarrier = async (values) => {
    const editingId = barrierDrawer?.barrier?.id || null;
    setBarrierDrawer(null);
    const saved = await savePatientCarePlanBarrier(patientId, program, values, editingId);
    if (saved) {
      showToast(`"${saved.title}" ${editingId ? 'updated' : 'added'}`);
      if (!editingId) refreshCarePlanDuplicates(patientId, program);
    }
  };

  // Undoing a cascade puts the goal back first, then re-links its children to
  // the new row — restoring them in any other order returns them loose.
  const undoGoalCascade = (goal, cascade) => ({
    label: 'Undo',
    onClick: async () => {
      const { id: goalId, ...goalValues } = goal; // eslint-disable-line no-unused-vars
      const restored = await savePatientCarePlanGoal(patientId, program, goalValues);
      for (const intv of cascade.interventions) {
        const { id: intvId, ...values } = intv; // eslint-disable-line no-unused-vars
        await savePatientCarePlanIntervention(patientId, program, { ...values, goalId: restored?.id || null });
      }
      for (const barrier of cascade.barriers) {
        const { id: barrierId, ...values } = barrier; // eslint-disable-line no-unused-vars
        await savePatientCarePlanBarrier(patientId, program, { ...values, goalId: restored?.id || null, goalIds: restored ? [restored.id] : [] });
      }
      refreshCarePlanDuplicates(patientId, program);
    },
  });

  // `withLinked` false leaves the goal's interventions and barriers on the plan.
  const removeGoal = async (withLinked) => {
    const { id, item } = deleteTarget;
    setDeleteTarget(null);
    const cascade = withLinked ? goalCascade(live, id) : { interventions: [], barriers: [] };
    const took = cascade.interventions.length + cascade.barriers.length;
    await deletePatientCarePlanGoal(patientId, program.id, id, { cascade: withLinked });
    showToast(
      took ? 'Goal & linked items removed successfully' : 'Goal removed successfully',
      item ? { action: undoGoalCascade(item, cascade), duration: 6000 } : undefined,
    );
  };

  const confirmDelete = async () => {
    const { kind, id, name, item } = deleteTarget;
    if (kind === 'goal') { await removeGoal(true); return; }
    setDeleteTarget(null);
    if (kind === 'barrier') deletePatientCarePlanBarrier(patientId, program.id, id);
    else deletePatientCarePlanIntervention(patientId, program.id, id);
    showToast(`"${name}" removed`, item ? { action: undoAction([{ kind: kind === 'intv' ? 'intervention' : kind, item }]), duration: 6000 } : undefined);
  };

  // ── Possible-duplicate resolution (Figma SNP-Story 8464:289403) ──
  // Every action only mutates THIS plan's item (never another program's plan).
  const deleteGbiById = (kind, id) => {
    if (kind === 'goal') deletePatientCarePlanGoal(patientId, program.id, id);
    else if (kind === 'barrier') deletePatientCarePlanBarrier(patientId, program.id, id);
    else deletePatientCarePlanIntervention(patientId, program.id, id);
  };
  const openGbiEditor = (kind, item) => {
    if (kind === 'goal') setPreviewGoal(item);
    else if (kind === 'barrier') setBarrierDrawer({ barrier: item });
    else setIntvDrawer({ intervention: item });
  };
  // Manual "Scan for Duplicates" (care plan ⋯ menu). Resets prior Ignore/resolve
  // choices so every current duplicate is re-surfaced, and reports the count.
  const scanForDuplicates = async () => {
    const n = await refreshCarePlanDuplicates(patientId, program, { reset: true });
    showToast(n > 0 ? `Found ${n} possible duplicate${n === 1 ? '' : 's'}` : 'No possible duplicates found');
  };
  const handleDuplicateIgnore = (flag) => dismissCarePlanDuplicate(key, flag.flagId);
  const handleDuplicateAcceptExisting = (flag) => {
    deleteGbiById(flag.kind, flag.newItem.id);
    dismissCarePlanDuplicate(key, flag.flagId);
  };
  const handleDuplicateAcceptNew = (flag) => {
    if (flag.existing.sameplan) deleteGbiById(flag.kind, flag.existing.item.id);
    dismissCarePlanDuplicate(key, flag.flagId);
  };
  const handleDuplicateEditExisting = (flag) => {
    deleteGbiById(flag.kind, flag.newItem.id);
    openGbiEditor(flag.kind, flag.existing.item);
    dismissCarePlanDuplicate(key, flag.flagId);
  };
  const renderDuplicateFlags = (kind) => (
    <CarePlanDuplicateGroup
      flags={duplicateFlags.filter(f => f.kind === kind)}
      onIgnore={handleDuplicateIgnore}
      onAcceptExisting={handleDuplicateAcceptExisting}
      onAcceptNew={handleDuplicateAcceptNew}
      onEditExisting={handleDuplicateEditExisting}
    />
  );

  const doAddProblem = async () => {
    const label = problemText.trim();
    if (!label || !live?.plan) return;
    const next = [...(live.plan.conditions || []).map(c => c.label), label];
    const ok = await savePatientCarePlanConditions(patientId, program, next);
    setProblemOpen(false);
    setProblemText('');
    if (ok) showToast(`Added "${label}"`);
  };

  const handleNewProblems = () => { setProblemText(''); setProblemOpen(true); };
  const handleTemplates = () => setTemplatesDrawerOpen(true);
  const handleApplyTemplates = async (ids, priorities) => {
    setTemplatesDrawerOpen(false);
    if (!canEdit) return;
    await applyPatientCarePlanTemplates(patientId, program, ids, priorities);
  };
  const handleTrends = () => setTrendsOpen(true);
  const handleAssigneeChange = (intervention, user) => {
    if (!canEdit) return;
    savePatientCarePlanIntervention(patientId, program, { ...intervention, assignee: { name: user.name, initials: user.initials } }, intervention.id);
    showToast(`Assigned to ${user.name}`);
  };

  const saveTemplate = async () => {
    if (!templateName.trim()) return;
    const saved = await savePatientCarePlanAsTemplate(patientId, program, templateName);
    setTemplateOpen(false);
    setTemplateName('');
    if (saved) showToast(`Saved as template "${saved.name}"`);
  };

  const rowMenuItems = () => [
    { key: 'rename', icon: 'solar:pen-linear', label: 'Edit', disabled: !canEdit },
    { key: 'delete', icon: 'solar:trash-bin-trash-linear', label: 'Delete', danger: true, disabled: !canEdit },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.stickyTop}>
        {/* pinned templates + problems bar */}
        <AppliedTemplateStrip
          templates={appliedTemplates}
          appliedTemplatePriorities={appliedTemplatePriorities}
          templateGoalCounts={templateGoalCounts}
          templateFilterId={templateFilterId}
          canRemove={canEdit && !live?.plan?.signedAt}
          onSelect={(id) => setTemplateFilterId(prev => (prev === id ? null : id))}
          onRemove={handleRemoveTemplate}
        />
        {/* Conditions are intentionally not surfaced in the plan header; they
            still travel with the plan and appear in the Share / Download
            preview (see CarePlanShareDrawer). */}
      </div>

      <div className={styles.scrollArea}>
      <div className={styles.contentBody}>
      {!carePlanLoading && (data.goals.length + data.interventions.length + (data.barriers || []).length) > 0 && (
        <div className={styles.summaryStrip}>
          <span className={styles.summaryMetric}><strong>{planStats.goals}</strong> goals</span>
          <span className={styles.summaryDot} aria-hidden="true" />
          <span className={styles.summaryMetric}><strong>{planStats.iv}</strong> interventions</span>
          <span className={styles.summaryDot} aria-hidden="true" />
          <span className={styles.summaryMetric}><strong>{planStats.br}</strong> barriers</span>
          <span className={styles.summaryDot} aria-hidden="true" />
          <span className={styles.summaryMetric}><strong>{planStats.avgProgress}%</strong> avg progress</span>
          {planStats.statuses.length > 0 && (
            <span className={styles.summaryStatuses}>
              {planStats.statuses.map(({ status, count, tone }) => (
                <Badge key={status} tone={tone} size="S" label={`${count} ${status}`} />
              ))}
            </span>
          )}
        </div>
      )}
      {!carePlanLoading && latestPlanNote && (
        <section className={styles.careNoteSection}>
          <div className={styles.careNoteHead}>
            <button
              type="button"
              className={styles.careNoteToggle}
              onClick={() => toggleSection('careNote')}
              aria-expanded={openSections.careNote}
            >
              <DownChevronIcon
                size={16}
                color="var(--neutral-400)"
                className={`${styles.sectionChevron} ${openSections.careNote ? '' : styles.sectionChevronClosed}`}
              />
              <span className={styles.careNoteHeadTitle}>Care Note</span>
            </button>
          </div>
          {openSections.careNote && latestPlanNote && (
            <div className={styles.careNoteCardWrap}>
              <button
                type="button"
                className={styles.careNoteCard}
                onClick={openNoteDrawer}
                disabled={!canEdit}
                aria-label="Edit care note"
              >
                <p className={styles.careNoteBody}>{latestPlanNote.detail}</p>
                <div className={styles.careNoteMeta}>
                  <span className={styles.careNoteAuthor}>{latestPlanNote.actor || 'Unknown'}</span>
                  <span className={styles.careNoteDot} aria-hidden="true">•</span>
                  <span className={styles.careNoteTimestamp}>
                    {latestPlanNote.createdAt
                      ? new Date(latestPlanNote.createdAt).toLocaleString('en-US', {
                          month: '2-digit', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit',
                        })
                      : ''}
                  </span>
                </div>
              </button>
              {canEdit && (
                <span className={styles.careNoteDelete}>
                  <ActionButton
                    icon="solar:trash-bin-trash-linear"
                    size="S"
                    tooltip="Delete note"
                    onClick={() => setNoteDeleteOpen(true)}
                    aria-label="Delete care note"
                  />
                </span>
              )}
            </div>
          )}
        </section>
      )}
      {filtersOpen && (
        <div className={styles.filterBar}>
          <FilterChip label="Status" options={GBI_STATUSES} selected={filters.status} onChange={v => setFilter('status', v)} />
          <FilterChip label="Priority" options={PRIORITY_LABELS} selected={filters.priority} onChange={v => setFilter('priority', v)} />
          <FilterChip label="Assignee" searchable options={assigneeOptions} selected={filters.assignee} onChange={v => setFilter('assignee', v)} />
          {filtersActive ? (
            <button type="button" className={styles.clearAll} onClick={clearFilters}>
              <Icon name="solar:backspace-linear" size={16} color="var(--primary-300)" />
              Clear All
            </button>
          ) : null}
        </div>
      )}

      {selectedCount > 0 && (
        <BulkBar
          className="js-careplan-bulkbar"
          selectedIds={[...selected.goal, ...selected.intv, ...selected.barrier]}
          onClear={clearSelection}
          actions={[{
            label: 'Set status',
            icon: 'solar:checklist-minimalistic-linear',
            // BulkBar action callbacks don't carry the event, so anchor the
            // menu to the floating bar itself (MenuPopover opens upward near
            // the viewport bottom).
            onClick: () => {
              const el = document.querySelector('.js-careplan-bulkbar');
              setBulkMenu({ rect: el ? el.getBoundingClientRect() : null, type: 'status' });
            },
          }, {
            label: 'Set priority',
            icon: 'solar:flag-linear',
            onClick: () => {
              const el = document.querySelector('.js-careplan-bulkbar');
              setBulkMenu({ rect: el ? el.getBoundingClientRect() : null, type: 'priority' });
            },
          }, {
            label: 'Assign',
            icon: 'solar:user-plus-linear',
            onClick: () => setBulkAssignOpen(true),
          }, {
            label: 'Delete',
            icon: 'solar:trash-bin-trash-linear',
            variant: 'danger',
            onClick: () => setBulkDeleteOpen(true),
          }]}
        />
      )}

      {/* Goals */}
      <div className={styles.section}>
        <GbiSectionHead
          title="Goals"
          count={filteredGoals.length}
          open={openSections.goals}
          onToggle={() => toggleSection('goals')}
          trailingEnd={(
            <button type="button" className={styles.trendsBtn} onClick={handleTrends}>
              <Icon name="solar:chart-2-linear" size={16} color="var(--neutral-300)" />
              Trends
            </button>
          )}
          addButton={(
            <ActionButton size="S" tooltip="Add goal" onClick={() => setAddGoalsDrawerOpen(true)} disabled={!canEdit}>
              <AddIconMinimalist size={16} color="var(--neutral-300)" />
            </ActionButton>
          )}
        />
        {renderDuplicateFlags('goal')}
        {openSections.goals && (carePlanLoading ? (
          <SimpleTableSkeleton rows={3} cols={6} />
        ) : filteredGoals.length === 0 && data.goals.length === 0 ? (
          <SectionEmptyState
            icon="solar:heart-pulse-linear"
            label="No Goals Added for Selected Problem"
            onAdd={() => setAddGoalsDrawerOpen(true)}
          />
        ) : (
          <CarePlanGoalsTable
            rows={filteredGoals}
            canEdit={canEdit}
            bulkMode={bulkMode}
            selectedIds={[...selected.goal]}
            onSelectAll={(checked) => selectAllKind('goal', filteredGoals, checked)}
            onToggleSelect={(id) => toggleSelect('goal', id)}
            onOpenGoal={setPreviewGoal}
            onPriorityMenu={setPriorityMenu}
            onStatusMenu={setStatusMenu}
            onRowMenu={setStatusMenu}
            onTargetDateChange={(goal, iso) => savePatientCarePlanGoal(patientId, program, { ...goal, targetDate: iso }, goal.id)}
            linked={linkedForGoal}
            emptyState={filteredGoals.length === 0 ? <div className={styles.emptyRow}>No goals match the filters.</div> : null}
          />
        ))}
      </div>

      {/* Interventions */}
      <div className={styles.section}>
        <GbiSectionHead
          title="Interventions"
          count={filteredInterventions.length}
          open={openSections.interventions}
          onToggle={() => toggleSection('interventions')}
          addButton={(
            <ActionButton
              ref={intvAddRef}
              size="S"
              tooltip="Add intervention"
              aria-haspopup="menu"
              aria-expanded={intvTypeMenuOpen}
              onClick={openInterventionTypeMenu}
              disabled={!canEdit}
            >
              <AddIconMinimalist size={16} color="var(--neutral-300)" />
            </ActionButton>
          )}
        />
        {intvTypeMenuOpen && (
          <MenuPopover
            anchorRef={intvAddRef}
            align="right"
            width={200}
            ariaLabel="Add intervention"
            items={CARE_PLAN_INTERVENTION_MENU}
            onSelect={handleInterventionTypeSelect}
            onClose={() => setIntvTypeMenuOpen(false)}
          />
        )}
        {renderDuplicateFlags('intervention')}
        {openSections.interventions && (carePlanLoading ? (
          <SimpleTableSkeleton rows={3} cols={6} />
        ) : filteredInterventions.length === 0 && data.interventions.length === 0 ? (
          <SectionEmptyState
            icon="solar:checklist-minimalistic-linear"
            label="No Interventions Created for Selected Problem"
            onAdd={openInterventionTypeMenu}
          />
        ) : (
          <CarePlanInterventionsTable
            rows={filteredInterventions}
            canEdit={canEdit}
            bulkMode={bulkMode}
            selectedIds={[...selected.intv]}
            onSelectAll={(checked) => selectAllKind('intv', filteredInterventions, checked)}
            onToggleSelect={(id) => toggleSelect('intv', id)}
            onOpenIntervention={setPreviewIntervention}
            onPriorityMenu={setPriorityMenu}
            onStatusMenu={setStatusMenu}
            onRowMenu={setStatusMenu}
            onAssigneeChange={handleAssigneeChange}
            onDueDateChange={(intv, iso) => savePatientCarePlanIntervention(patientId, program, {
              ...intv,
              config: { ...(intv.config || {}), dueDateOverride: iso || '' },
            }, intv.id)}
            onRecurrenceChange={(intv, next) => savePatientCarePlanIntervention(patientId, program, {
              ...intv,
              config: { ...(intv.config || {}), ...next },
            }, intv.id)}
            linked={linkedForChild}
            platformUsers={platformUsers}
            patients={patientName ? [{
              id: patientId,
              name: patientName,
              initials: (patientName || '').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase(),
            }] : []}
            emptyState={filteredInterventions.length === 0 ? <div className={styles.emptyRow}>No interventions match the filters.</div> : null}
          />
        ))}
      </div>

      {/* Open Barriers */}
      <div className={styles.section}>
        <GbiSectionHead
          title="Open Barriers"
          count={filteredBarriers.length}
          open={openSections.barriers}
          onToggle={() => toggleSection('barriers')}
          addButton={(
            <ActionButton size="S" tooltip="Add barrier" onClick={() => setAddBarriersDrawerOpen(true)} disabled={!canEdit}>
              <AddIconMinimalist size={16} color="var(--neutral-300)" />
            </ActionButton>
          )}
        />
        {openSections.barriers && (carePlanLoading ? (
          <SimpleTableSkeleton rows={3} cols={3} />
        ) : filteredBarriers.length === 0 && (data.barriers || []).length === 0 ? (
          <SectionEmptyState
            icon="solar:signpost-2-linear"
            label="No Barriers Created for Selected Problem"
            onAdd={() => setAddBarriersDrawerOpen(true)}
          />
        ) : (
          <CarePlanBarriersTable
            rows={filteredBarriers}
            canEdit={canEdit}
            bulkMode={bulkMode}
            selectedIds={[...selected.barrier]}
            onSelectAll={(checked) => selectAllKind('barrier', filteredBarriers, checked)}
            onToggleSelect={(id) => toggleSelect('barrier', id)}
            onStatusMenu={setStatusMenu}
            onRowMenu={setStatusMenu}
            onOpenBarrier={setPreviewBarrier}
            linked={linkedForChild}
            emptyState={filteredBarriers.length === 0 ? <div className={styles.emptyRow}>No barriers match the filters.</div> : null}
          />
        ))}
      </div>
      </div>
      </div>

      {/* Status change menu (goals + interventions + barriers) */}
      {statusMenu && (statusMenu.kind === 'goal' || statusMenu.kind === 'intv' || statusMenu.kind === 'barrier') && (
        <MenuPopover
          anchorRect={statusMenu.rect}
          align="left"
          width={160}
          ariaLabel="Change status"
          items={GBI_STATUSES.map(s => ({ key: s, label: s }))}
          onSelect={changeStatus}
          onClose={() => setStatusMenu(null)}
        />
      )}

      {bulkMenu && (
        <MenuPopover
          anchorRect={bulkMenu.rect}
          align="left"
          width={180}
          ariaLabel={bulkMenu.type === 'priority' ? 'Set priority for selected' : 'Set status for selected'}
          items={bulkMenu.type === 'priority'
            ? PRIORITIES.map(p => ({ key: p, label: p.charAt(0).toUpperCase() + p.slice(1), iconElement: <PriorityIcon priority={p} size={16} /> }))
            : GBI_STATUSES.map(s => ({ key: s, label: s }))}
          onSelect={bulkMenu.type === 'priority' ? bulkSetPriority : bulkSetStatus}
          onClose={() => setBulkMenu(null)}
        />
      )}

      {linkOwner && (
        <CarePlanLinkDrawer
          patientId={patientId}
          program={program}
          patientName={patientName}
          owner={linkOwner}
          onClose={() => setLinkOwner(null)}
        />
      )}

      {/* Row overflow menu (rename / remove) */}
      {statusMenu && (statusMenu.kind === 'goal-menu' || statusMenu.kind === 'intv-menu' || statusMenu.kind === 'barrier-menu') && (
        <MenuPopover
          anchorRect={statusMenu.rect}
          width={160}
          ariaLabel="Row actions"
          items={rowMenuItems()}
          onSelect={(k) => {
            const kind = statusMenu.kind;
            const isGoal = kind === 'goal-menu';
            const isBarrier = kind === 'barrier-menu';
            const item = statusMenu.item;
            setStatusMenu(null);
            if (k === 'delete') setDeleteTarget({ kind: isGoal ? 'goal' : isBarrier ? 'barrier' : 'intv', id: item.id, name: item.title, item });
            else if (k === 'rename' && isBarrier) setBarrierDrawer({ barrier: item });
            // Intervention "Edit" goes straight to the kind-specific
            // editor, skipping the Preview drawer. No `previewOnClose`
            // is set here — closing the editor returns to the plan
            // screen, matching what the user picked from the menu.
            else if (k === 'rename' && !isGoal) setIntvSpecialDrawer({ kind: item.kind, intervention: item });
            // Goal rename happens inline via EditableTitle; nudge the user there.
            else if (k === 'rename' && isGoal) showToast('Open the goal to review details — use Remove to delete it.');
          }}
          onClose={() => setStatusMenu(null)}
        />
      )}

      {/* Priority change menu (goals / barriers / interventions) */}
      {priorityMenu && (
        <MenuPopover
          anchorRect={priorityMenu.rect}
          align="left"
          width={160}
          ariaLabel="Change priority"
          items={PRIORITIES.map(p => ({ key: p, label: p.charAt(0).toUpperCase() + p.slice(1), iconElement: <PriorityIcon priority={p} size={16} /> }))}
          onSelect={changePriority}
          onClose={() => setPriorityMenu(null)}
        />
      )}

      {addGoalsDrawerOpen && (
        <AddGoalsDrawer
          onClose={() => setAddGoalsDrawerOpen(false)}
          onAdd={handleAddGoalsFromPicker}
        />
      )}

      {previewGoal && (
        <GoalPreviewDrawer
          goal={previewGoal}
          patientId={patientId}
          program={program}
          onClose={() => setPreviewGoal(null)}
          onOpenIntervention={setPreviewIntervention}
        />
      )}

      {previewBarrier && (
        <BarrierDetailDrawer
          barrier={previewBarrier}
          patientId={patientId}
          program={program}
          onClose={() => setPreviewBarrier(null)}
          onOpenGoal={(g) => { setPreviewBarrier(null); setPreviewGoal(g); }}
        />
      )}

      {previewIntervention && (
        <InterventionPreviewDrawer
          intervention={previewIntervention}
          patientId={patientId}
          program={program}
          onClose={() => setPreviewIntervention(null)}
          onEdit={(intv) => {
            // Open the full intervention edit drawer for this kind so the
            // user can edit fields beyond just the title (Send Form,
            // Patient Education, Patient Task, Measure Vital, Internal
            // Task). Close preview first, then open the special editor.
            // `previewOnClose` tells the editor to reopen the preview
            // when the user closes or updates it, so they land back on
            // the intervention detail instead of the plan screen.
            setPreviewIntervention(null);
            setIntvSpecialDrawer({ kind: intv.kind, intervention: intv, previewOnClose: intv });
          }}
          onOpenGoal={(g) => { setPreviewIntervention(null); setPreviewGoal(g); }}
        />
      )}

      {intvDrawer && (
        <AddInterventionDrawer
          intervention={intvDrawer.intervention}
          onClose={() => setIntvDrawer(false)}
          onSave={handleAddIntervention}
        />
      )}

      {intvSpecialDrawer && (() => {
        const Editor = INTERVENTION_EDITORS[intvSpecialDrawer.kind];
        if (!Editor) return null;
        const intv = intvSpecialDrawer.intervention;
        const activityEntries = intv?.id ? auditAll
          .filter(a => a.entityType === 'intervention' && String(a.entityId) === String(intv.id))
          .sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt))
          .map(a => {
            const created = a.createdAt ? new Date(a.createdAt) : null;
            return {
              id: a.id,
              t: 'status_change',
              date: created ? created.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null,
              time: created ? created.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null,
              by: a.actor || null,
              title: a.summary || 'Intervention updated',
            };
          }) : [];
        const currentLinked = Array.isArray(intv?.goalIds) && intv.goalIds.length > 0
          ? intv.goalIds
          : (intv?.goalId ? [intv.goalId] : []);
        // Merge the intervention row's top-level columns into the config
        // blob before handing it to the editor. Legacy rows either only
        // stored `title` / `priority` / `assignee` at the top level, or
        // stored empty strings inside config; without this, opening the
        // edit drawer showed empty fields. Uses `||` (not `??`) so an
        // empty-string in the config falls through to the top-level
        // column.
        const editorIntervention = intv ? {
          ...(intv.config || {}),
          id: intv.id,
          title: (intv.config && intv.config.title) || intv.title || '',
          priority: (intv.config && intv.config.priority) || intv.priority || 'Medium',
          assignedTo: (intv.config && intv.config.assignedTo)
            || (intv.assignee && intv.assignee.name && intv.assignee.name !== 'Unassigned' ? intv.assignee.name : '')
            || '',
        } : null;
        return (
          <Editor
            kind={intvSpecialDrawer.kind}
            intervention={editorIntervention}
            linkToGoalsAllowed
            availableGoals={data.goals}
            linkedGoalIds={currentLinked}
            activityEntries={activityEntries}
            memberName={patientName}
            onOpenGoal={(g) => { setIntvSpecialDrawer(null); setPreviewGoal(g); }}
            onClose={() => {
              // Reopen the preview drawer the editor was launched from so
              // the user lands back on the intervention detail instead of
              // the plan screen. `previewOnClose` is only set when the
              // editor was opened via the preview's edit affordance.
              const restore = intvSpecialDrawer.previewOnClose;
              setIntvSpecialDrawer(null);
              if (restore) setPreviewIntervention(restore);
            }}
            onSave={async (config) => {
              await saveInterventionFromConfig(
                intvSpecialDrawer.kind,
                config,
                intv?.id || null,
              );
              const restore = intvSpecialDrawer.previewOnClose;
              setIntvSpecialDrawer(null);
              if (restore) setPreviewIntervention(restore);
            }}
          />
        );
      })()}

      {taskDrawerOpen && (
        <AddTaskDrawer
          taskKind={taskDrawerOpen}
          initialMember={patientName}
          initialAssignedTo={taskDrawerOpen === 'internal-task' ? '' : patientName}
          showScheduleFields
          availableGoals={data.goals}
          onOpenGoal={(g) => { setTaskDrawerOpen(null); setPreviewGoal(g); }}
          onClose={() => setTaskDrawerOpen(null)}
          onTaskCreated={async (t) => {
            await saveInterventionFromConfig(taskDrawerOpen, { title: t?.name || '', taskId: t?.id });
            setTaskDrawerOpen(null);
          }}
        />
      )}

      {addBarriersDrawerOpen && (
        <AddBarriersDrawer
          onClose={() => setAddBarriersDrawerOpen(false)}
          onAdd={handleAddBarriersFromPicker}
          existingBarriers={data.barriers || []}
        />
      )}

      {barrierDrawer?.barrier && (
        <BarrierDrawer
          barrier={barrierDrawer.barrier}
          onClose={() => setBarrierDrawer(null)}
          onSave={({ title, description }) => handleAddBarrier({
            title,
            description,
            status: barrierDrawer.barrier?.status || 'Not Started',
            priority: barrierDrawer.barrier?.priority || 'medium',
          })}
        />
      )}

      {shareOpen && (
        <CarePlanShareDrawer
          patientId={patientId}
          program={program}
          data={data}
          patientName={patientName}
          canShare={canEdit}
          onClose={clearCarePlanShareRequest}
        />
      )}

      {historyOpen && (
        <CarePlanHistoryDrawer patientId={patientId} program={program} onClose={() => setHistoryOpen(false)} />
      )}

      {versionsOpen && (
        <CarePlanVersionsDrawer patientId={patientId} program={program} onClose={() => setVersionsOpen(false)} />
      )}

      {signOpen && (
        <Drawer
          title="Sign Care Plan"
          onClose={() => setSignOpen(false)}
          secondaryAction={<Button variant="secondary" size="L" onClick={() => setSignOpen(false)}>Cancel</Button>}
          primaryAction={<Button variant="primary" size="L" onClick={doSign}>Sign</Button>}
        >
          <div className={styles.drawerBody}>
            <p className={styles.drawerHint}>Signing saves a version snapshot of the plan and records who signed it. You can still add notes and change statuses afterwards.</p>
            <div className={styles.drawerField}>
              <span className={styles.drawerLabel}>Note <span className={styles.optional}>(optional)</span></span>
              <Textarea value={signNote} onChange={e => setSignNote(e.target.value)} placeholder="Add a sign-off note" rows={3} />
            </div>
          </div>
        </Drawer>
      )}

      {noteOpen && (
        <Drawer
          title={latestPlanNote ? 'Update Note' : 'Add Note'}
          onClose={() => closeNoteDrawer()}
          primaryAction={
            <Button
              variant="primary"
              size="L"
              onClick={doAddNote}
              disabled={!noteText.trim() || !noteDirty}
            >
              {latestPlanNote ? 'Update Note' : 'Add Note'}
            </Button>
          }
        >
          <div className={styles.drawerBody}>
            <p className={styles.drawerHint}>Records a maintenance note on the signed plan without editing it — it appears in the plan's History.</p>
            <div className={styles.drawerField}>
              <span className={styles.drawerLabel}>Note <span className={styles.required}>*</span></span>
              <Textarea autoFocus value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="e.g. Reviewed with patient; no changes needed." rows={3} />
            </div>
            {noteTimelineEntries.length > 0 && (
              <div className={styles.noteTimeline}>
                <span className={styles.noteTimelineLabel}>Change log</span>
                <ActivityLog entries={noteTimelineEntries} hideCommentTitle />
              </div>
            )}
          </div>
        </Drawer>
      )}
      {noteDiscardOpen && (
        <ConfirmDialog
          variant="destructive"
          title="Discard unsaved changes?"
          description="You'll lose the edits you just made to this note."
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          onCancel={() => setNoteDiscardOpen(false)}
          onConfirm={() => { setNoteDiscardOpen(false); closeNoteDrawer({ force: true }); }}
        />
      )}
      {noteDeleteOpen && (
        <ConfirmDialog
          variant="destructive"
          title="Delete this care note?"
          description="The note is removed from the plan surface, but every past note stays in the plan's history."
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onCancel={() => setNoteDeleteOpen(false)}
          onConfirm={doClearCareNote}
        />
      )}

      {problemOpen && (
        <Drawer
          title="Add Problem"
          onClose={() => setProblemOpen(false)}
          secondaryAction={<Button variant="secondary" size="L" onClick={() => setProblemOpen(false)}>Cancel</Button>}
          primaryAction={<Button variant="primary" size="L" onClick={doAddProblem} disabled={!problemText.trim()}>Add</Button>}
        >
          <div className={styles.drawerBody}>
            <p className={styles.drawerHint}>Adds a problem/condition to this care plan. It shows in the problems bar and groups the goals, interventions, and barriers that address it.</p>
            <div className={styles.drawerField}>
              <span className={styles.drawerLabel}>Problem <span className={styles.required}>*</span></span>
              <Input
                autoFocus
                value={problemText}
                onChange={e => setProblemText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && problemText.trim()) { e.preventDefault(); doAddProblem(); } }}
                placeholder="e.g. Chronic Kidney Disease"
                aria-label="Problem"
              />
            </div>
          </div>
        </Drawer>
      )}

      {trendsOpen && (
        <CarePlanTrendsDrawer
          goals={data.goals}
          measurements={measurements}
          onClose={() => setTrendsOpen(false)}
        />
      )}

      {templatesDrawerOpen && (
        <ApplyTemplatesDrawer
          appliedTemplateIds={appliedTemplateIds}
          appliedTemplatePriorities={appliedTemplatePriorities}
          onClose={() => setTemplatesDrawerOpen(false)}
          onApply={handleApplyTemplates}
        />
      )}

      {templateOpen && (
        <Drawer
          title="Save as Template"
          onClose={() => setTemplateOpen(false)}
          secondaryAction={<Button variant="secondary" size="L" onClick={() => setTemplateOpen(false)}>Cancel</Button>}
          primaryAction={<Button variant="primary" size="L" onClick={saveTemplate} disabled={!templateName.trim()}>Save</Button>}
        >
          <div className={styles.drawerBody}>
            <p className={styles.drawerHint}>Saves this plan's goals and interventions to the Care Plan Library so it can be reused for similar patients.</p>
            <div className={styles.drawerField}>
              <span className={styles.drawerLabel}>Template Name <span className={styles.required}>*</span></span>
              <Input autoFocus value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="e.g. Type 2 Diabetes — Standard" aria-label="Template name" />
            </div>
          </div>
        </Drawer>
      )}

      {deleteTarget?.kind === 'goal' && (
        <RemoveGoalDialog
          goalTitle={deleteTarget.name}
          cascade={goalCascade(live, deleteTarget.id)}
          onRemoveAll={() => removeGoal(true)}
          onRemoveGoalOnly={() => removeGoal(false)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {deleteTarget && deleteTarget.kind !== 'goal' && (
        <ConfirmDialog
          icon="solar:danger-triangle-linear"
          iconColor="var(--status-error)"
          title={`Remove "${deleteTarget.name}"?`}
          description="This removes it from the patient's care plan. This action cannot be undone."
          confirmLabel="Remove"
          variant="error"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}

      <SelectAssigneeModal
        open={bulkAssignOpen}
        onClose={() => setBulkAssignOpen(false)}
        onConfirm={bulkAssign}
        title="Assign interventions"
        confirmLabel="Assign"
      />

      {bulkDeleteOpen && (
        <ConfirmDialog
          icon="solar:danger-triangle-linear"
          iconColor="var(--status-error)"
          title={`Remove ${selectedCount} item${selectedCount === 1 ? '' : 's'}?`}
          description="This removes the selected goals, interventions, and barriers from the patient's care plan. This action cannot be undone."
          confirmLabel="Remove"
          variant="error"
          onCancel={() => setBulkDeleteOpen(false)}
          onConfirm={bulkDelete}
        />
      )}
    </div>
  );
}
