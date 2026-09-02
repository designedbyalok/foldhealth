import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../../../../../../components/Icon/Icon';
import { AddIconMinimalist } from '../../../../../../../components/Icon/AddIconMinimalist';
import { ActionButton } from '../../../../../../../components/ActionButton/ActionButton';
import { Button } from '../../../../../../../components/Button/Button';
import { Input } from '../../../../../../../components/Input/Input';
import { Textarea } from '../../../../../../../components/Textarea/Textarea';
import { Drawer } from '../../../../../../../components/Drawer/Drawer';
import { MenuPopover } from '../../../../../../../components/MenuPopover/MenuPopover';
import { SelectAssigneeModal } from '../../../../../../../components/SelectAssigneeModal/SelectAssigneeModal';
import { PriorityIcon } from '../../../../../../../components/PriorityIcon/PriorityIcon';
import { ConfirmDialog } from '../../../../../../../components/ConfirmDialog/ConfirmDialog';
import { Select } from '../../../../../../../components/Select/Select';
import { FilterChip } from '../../../../../../../components/FilterChip/FilterChip';
import { useAppStore } from '../../../../../../../store/useAppStore';
import { AddGoalsDrawer } from '../../../../../../settings/care-plan-library/goals/AddGoalsDrawer/AddGoalsDrawer';
import { AddBarriersDrawer } from '../../../../../../settings/care-plan-library/barriers/AddBarriersDrawer/AddBarriersDrawer';
import { AddInterventionDrawer } from '../drawers/AddInterventionDrawer/AddInterventionDrawer';
import { SendFormDrawer } from '../../../../../../settings/care-plan-library/interventions/SendFormDrawer/SendFormDrawer';
import { SendContentDrawer } from '../../../../../../settings/care-plan-library/interventions/SendContentDrawer/SendContentDrawer';
import { MeasureVitalDrawer } from '../../../../../../settings/care-plan-library/interventions/MeasureVitalDrawer/MeasureVitalDrawer';
import { AddTaskDrawer } from '../../../../../../tasks/AddTaskDrawer';
import {
  CARE_PLAN_INTERVENTION_MENU,
  CARE_PLAN_INTERVENTION_ICONS,
  interventionDurationFromConfig,
  interventionPriorityFromConfig,
} from '../lib/carePlanInterventionMenu';
import { CarePlanShareDrawer } from '../drawers/CarePlanShareDrawer/CarePlanShareDrawer';
import { CarePlanHistoryDrawer } from '../drawers/CarePlanHistoryDrawer/CarePlanHistoryDrawer';
import { CarePlanVersionsDrawer } from '../drawers/CarePlanVersionsDrawer/CarePlanVersionsDrawer';
import { CarePlanLinkDrawer } from '../drawers/CarePlanLinkDrawer/CarePlanLinkDrawer';
import { CarePlanTrendsDrawer } from '../drawers/CarePlanTrendsDrawer/CarePlanTrendsDrawer';
import { GoalPreviewDrawer } from '../drawers/GoalPreviewDrawer/GoalPreviewDrawer';
import { InterventionPreviewDrawer } from '../drawers/InterventionPreviewDrawer/InterventionPreviewDrawer';
import { deriveGoalTableFields } from '../lib/goalMetrics';
import { isCarePlanSigned } from '../lib/carePlanSignState';
import { CarePlanGoalsTable } from '../tables/CarePlanGoalsTable';
import { CarePlanInterventionsTable } from '../tables/CarePlanInterventionsTable';
import { CarePlanBarriersTable } from '../tables/CarePlanBarriersTable';
import { RingEmptyState } from '../../../../../../../components/RingEmptyState/RingEmptyState';
import { SimpleTableSkeleton } from '../../../../../../../components/SimpleTableSkeleton/SimpleTableSkeleton';
import { DownChevronIcon } from '../../../../../../../components/Icon/DownChevronIcon';
import { BulkBar } from '../../../../../../../components/BulkBar/BulkBar';
import { Badge } from '../../../../../../../components/Badge/Badge';
import { ApplyTemplatesDrawer } from '../drawers/ApplyTemplatesDrawer/ApplyTemplatesDrawer';
import { CarePlanDuplicateGroup } from '../DuplicateFlag/CarePlanDuplicateGroup';
import { templateGoalCount } from '../lib/carePlanTemplateApply';
import styles from './CarePlanView.module.css';

const EMPTY_ARR = [];

// The statuses a goal or intervention can move through. Kept flat and shared so
// the pill menu and the intervention drawer offer the same vocabulary.
const GBI_STATUSES = ['Not Started', 'In Progress', 'On Hold', 'Met', 'Not Met'];
const PRIORITIES = ['high', 'medium', 'low'];
// Capitalized labels for the priority filter chip (values compare case-insensitively).
const PRIORITY_LABELS = ['High', 'Medium', 'Low'];

const INTERVENTION_EDITORS = {
  'send-form': SendFormDrawer,
  'patient-education': SendContentDrawer,
  'measure-vital': MeasureVitalDrawer,
};

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
  const showToast = useAppStore(s => s.showToast);
  const patientName = useAppStore(s => s.patients.find(p => p.id === patientId)?.name);
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
  const fetchCarePlanLibrary = useAppStore(s => s.fetchCarePlanLibrary);
  const applyPatientCarePlanTemplates = useAppStore(s => s.applyPatientCarePlanTemplates);
  const savePatientCarePlanConditions = useAppStore(s => s.savePatientCarePlanConditions);

  const key = patientId && program ? `${patientId}::${program.id}` : null;
  const live = useAppStore(s => (key ? s.patientCarePlans[key] : null));
  const duplicateFlags = useAppStore(s => (key ? s.carePlanDuplicateFlags[key] : null)) || EMPTY_ARR;
  // First-load skeleton: true while the initial fetch is in flight (before the
  // plan resolves), false once loaded.
  const carePlanLoading = useAppStore(s => (key ? !!s.patientCarePlanLoading[key] : false));

  const fetchCarePlanLinks = useAppStore(s => s.fetchCarePlanLinks);
  const carePlanLinks = useAppStore(s => (key ? s.patientCarePlanLinks[key] : null)) || [];
  const [linkOwner, setLinkOwner] = useState(null); // null | { kind, item }
  const linkCount = (id) => carePlanLinks.filter(l => l.ownerId === String(id)).length;

  useEffect(() => {
    if (patientId && program?.id) {
      fetchPatientCarePlan(patientId, program.id);
      fetchCarePlanLinks(patientId, program.id);
      // Surface duplicates already sitting on this (and other) plans on load.
      refreshCarePlanDuplicates(patientId, program);
    }
  }, [patientId, program?.id, fetchPatientCarePlan, fetchCarePlanLinks, refreshCarePlanDuplicates]); // eslint-disable-line react-hooks/exhaustive-deps -- program object is stable by id

  useEffect(() => { fetchCarePlanLibrary?.(); }, [fetchCarePlanLibrary]);

  useEffect(() => {
    if (!carePlanPanelRequest) return;
    if (carePlanPanelRequest === 'versions') setVersionsOpen(true);
    else if (carePlanPanelRequest === 'template') { setTemplateName(''); setTemplateOpen(true); }
    else if (carePlanPanelRequest === 'history') setHistoryOpen(true);
    else if (carePlanPanelRequest === 'filter') setFiltersOpen(true);
    else if (carePlanPanelRequest === 'note') { setNoteText(''); setNoteOpen(true); }
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

  const [conditionsViewOpen, setConditionsViewOpen] = useState(false);
  const [problemOpen, setProblemOpen] = useState(false);
  const [problemText, setProblemText] = useState('');
  const [trendsOpen, setTrendsOpen] = useState(false);
  const MAX_VISIBLE_CONDITIONS = 4;
  // Collapsible GBI sections (chevron in each section header).
  // Remember which GBI sections are collapsed across visits (per-device UI pref).
  const [openSections, setOpenSections] = useState(() => {
    const fallback = { goals: true, interventions: true, barriers: true };
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
  const [templatesDrawerOpen, setTemplatesDrawerOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null); // { kind, id, name }
  const [historyOpen, setHistoryOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [signNote, setSignNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
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
  const filteredGoals = useMemo(() => data.goals.filter(matchesSP), [data.goals, filters]); // eslint-disable-line react-hooks/exhaustive-deps
  const filteredBarriers = useMemo(() => (data.barriers || []).filter(matchesSP), [data.barriers, filters]); // eslint-disable-line react-hooks/exhaustive-deps
  const filteredInterventions = useMemo(
    () => data.interventions.filter(i => matchesSP(i) && (!filters.assignee.length || filters.assignee.includes(i.assignee?.name))),
    [data.interventions, filters], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const conditionCounts = useMemo(() => {
    const counts = new Map();
    const bump = (label) => {
      if (!label) return;
      counts.set(label, (counts.get(label) || 0) + 1);
    };
    for (const g of data.goals) (g.conditions || []).forEach(bump);
    for (const i of data.interventions) (i.conditions || []).forEach(bump);
    for (const b of data.barriers || []) (b.conditions || []).forEach(bump);
    if (!counts.size) {
      const total = data.goals.length + data.interventions.length + (data.barriers?.length || 0);
      if (total && data.conditions[0]) counts.set(data.conditions[0].label, total);
    }
    return counts;
  }, [data.goals, data.interventions, data.barriers, data.conditions]);

  // Plan-level rollup for the summary strip: counts, status mix, avg goal progress.
  const planStats = useMemo(() => {
    const goals = data.goals, iv = data.interventions, br = data.barriers || [];
    const all = [...goals, ...iv, ...br];
    const avgProgress = goals.length
      ? Math.round(goals.reduce((sum, g) => sum + (Number(g.progress) || 0), 0) / goals.length)
      : 0;
    return {
      goals: goals.length,
      iv: iv.length,
      br: br.length,
      total: all.length,
      met: all.filter(x => x.status === 'Met').length,
      inProgress: all.filter(x => x.status === 'In Progress').length,
      overdue: all.filter(x => x.status === 'Overdue').length,
      avgProgress,
    };
  }, [data]);

  const visibleConditions = data.conditions.slice(0, MAX_VISIBLE_CONDITIONS);
  const hiddenConditionCount = Math.max(0, data.conditionTotal - visibleConditions.length);
  const appliedTemplateIds = live?.plan?.appliedTemplateIds || [];
  const appliedTemplates = useMemo(
    () => appliedTemplateIds
      .map(id => carePlanTemplates.find(t => t.id === id))
      .filter(Boolean),
    [appliedTemplateIds, carePlanTemplates],
  );
  const appliedTemplateCount = appliedTemplates.length;
  // Cap the applied-template chips so a heavily-templated plan doesn't bury the
  // GBI tables under rows of badges; the rest collapse into a "+N" that opens
  // the templates drawer.
  const MAX_VISIBLE_TEMPLATES = 4;
  const visibleTemplates = appliedTemplates.slice(0, MAX_VISIBLE_TEMPLATES);
  const hiddenTemplateCount = appliedTemplateCount - visibleTemplates.length;
  const signedBy = live?.plan?.signedBy;
  const signedAt = live?.plan?.signedAt;
  const showSignedBanner = isCarePlanSigned(live?.plan);

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
  const doAddNote = async () => {
    setNoteOpen(false);
    await addCarePlanNote(patientId, program, noteText);
    setNoteText('');
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

  const handleAddGoalsFromPicker = async (picked) => {
    setAddGoalsDrawerOpen(false);
    if (!picked?.length) return;
    const existingTitles = new Set(data.goals.map(g => g.title.trim().toLowerCase()));
    let added = 0;
    for (const g of picked) {
      const titleKey = g.title.trim().toLowerCase();
      if (existingTitles.has(titleKey)) continue;
      const goal = await savePatientCarePlanGoal(patientId, program, {
        title: g.title,
        subtitle: g.detail || '',
        category: g.category || '',
        priority: g.priority || 'medium',
        icon: 'solar:flag-linear',
        status: 'Not Started',
      });
      if (goal) {
        added += 1;
        existingTitles.add(titleKey);
      }
    }
    if (added) { showToast(`Added ${added} goal${added === 1 ? '' : 's'}`); refreshCarePlanDuplicates(patientId, program); }
    else showToast('Selected goals are already on this plan');
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
    const saved = await savePatientCarePlanIntervention(patientId, program, {
      kind,
      title: config.title,
      icon: CARE_PLAN_INTERVENTION_ICONS[kind] || 'solar:clipboard-list-linear',
      duration: interventionDurationFromConfig(config),
      priority: interventionPriorityFromConfig(config),
      config,
      status: 'Not Started',
      assignee: { name: 'Unassigned', initials: '' },
    }, editingId);
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

  const handleAddBarriersFromPicker = async (picked) => {
    setAddBarriersDrawerOpen(false);
    if (!picked?.length) return;
    const existingTitles = new Set((data.barriers || []).map(b => b.title.trim().toLowerCase()));
    let added = 0;
    for (const b of picked) {
      const titleKey = b.title.trim().toLowerCase();
      if (existingTitles.has(titleKey)) continue;
      const saved = await savePatientCarePlanBarrier(patientId, program, {
        title: b.title,
        description: b.description || '',
        status: 'Not Started',
        priority: 'medium',
      });
      if (saved) {
        added += 1;
        existingTitles.add(titleKey);
      }
    }
    if (added) { showToast(`Added ${added} barrier${added === 1 ? '' : 's'}`); refreshCarePlanDuplicates(patientId, program); }
    else showToast('Selected barriers are already on this plan');
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

  const confirmDelete = () => {
    const { kind, id, name, item } = deleteTarget;
    if (kind === 'goal') deletePatientCarePlanGoal(patientId, program.id, id);
    else if (kind === 'barrier') deletePatientCarePlanBarrier(patientId, program.id, id);
    else deletePatientCarePlanIntervention(patientId, program.id, id);
    setDeleteTarget(null);
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

  // Condition/problem chip interactions — View All, remove, add. All persist to
  // the plan header row (conditions array) and update the cache immediately.
  const handleRemoveCondition = async (label) => {
    if (!canEdit || !live?.plan) return;
    const next = (live.plan.conditions || []).map(c => c.label).filter(l => l !== label);
    const ok = await savePatientCarePlanConditions(patientId, program, next);
    if (ok) showToast(`Removed "${label}"`);
  };

  const doAddProblem = async () => {
    const label = problemText.trim();
    if (!label || !live?.plan) return;
    const next = [...(live.plan.conditions || []).map(c => c.label), label];
    const ok = await savePatientCarePlanConditions(patientId, program, next);
    setProblemOpen(false);
    setProblemText('');
    if (ok) showToast(`Added "${label}"`);
  };

  const handleViewAllConditions = () => setConditionsViewOpen(true);
  const handleNewProblems = () => { setProblemText(''); setProblemOpen(true); };
  const handleTemplates = () => setTemplatesDrawerOpen(true);
  const handleApplyTemplates = async (ids) => {
    setTemplatesDrawerOpen(false);
    if (!canEdit) return;
    await applyPatientCarePlanTemplates(patientId, program, ids);
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
    { key: 'rename', icon: 'solar:pen-linear', label: 'Rename', disabled: !canEdit },
    { key: 'delete', icon: 'solar:trash-bin-trash-linear', label: 'Remove', danger: true, disabled: !canEdit },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.stickyTop}>
        {/* Sticky problems / templates bar — Paper BPH-0 */}
        <div className={styles.problemsBar}>
          <div className={styles.conditionRow}>
            <div className={styles.chips}>
              {visibleTemplates.map(t => (
                <button
                  key={t.id}
                  type="button"
                  className={styles.appliedTemplateBadge}
                  onClick={() => setTemplatesDrawerOpen(true)}
                  aria-label={`${t.name}, ${templateGoalCount(t)} goals`}
                >
                  <Badge
                    tone="grey"
                    size="S"
                    icon="solar:bookmark-linear"
                    label={t.name}
                    trailingIconElement={<span className={styles.appliedTemplateCount}>{templateGoalCount(t)}</span>}
                  />
                </button>
              ))}
              {hiddenTemplateCount > 0 ? (
                <button
                  type="button"
                  className={styles.appliedTemplateBadge}
                  onClick={() => setTemplatesDrawerOpen(true)}
                  aria-label={`Show ${hiddenTemplateCount} more applied templates`}
                >
                  <Badge tone="grey" size="S" label={`+${hiddenTemplateCount}`} />
                </button>
              ) : null}
              {visibleConditions.map(c => {
                const count = conditionCounts.get(c.label) ?? 0;
                const isAlert = !!(c.primary || c.alert);
                return (
                  <span
                    key={c.label}
                    className={`${styles.chip} ${isAlert ? styles.chipAlert : styles.chipDefault}`}
                  >
                    {isAlert ? (
                      <Icon name="solar:danger-circle-linear" size={12} color="var(--status-error)" className={styles.chipAlertIcon} />
                    ) : null}
                    <span className={styles.chipLabel}>{c.label}</span>
                    <span className={styles.chipCount}>{count}</span>
                    {c.removable ? (
                      <>
                        <span className={styles.chipInnerDivider} aria-hidden="true" />
                        <button type="button" className={styles.chipRemove} onClick={() => handleRemoveCondition(c.label)} aria-label={`Remove ${c.label}`} disabled={!canEdit}>
                          <Icon name="solar:close-linear" size={16} color="var(--neutral-300)" />
                        </button>
                      </>
                    ) : null}
                  </span>
                );
              })}
              {hiddenConditionCount > 0 ? (
                <button type="button" className={`${styles.chip} ${styles.chipDefault} ${styles.chipOverflow}`} onClick={handleViewAllConditions}>
                  +{hiddenConditionCount}
                </button>
              ) : null}
            </div>
            <div className={styles.conditionActions}>
              <button type="button" className={styles.problemsBtn} onClick={handleNewProblems}>
                <Icon name="solar:add-linear" size={16} color="var(--primary-300)" />
                Problems
              </button>
              <span className={styles.conditionDivider} aria-hidden="true" />
              <button type="button" className={styles.templatesBtn} onClick={handleTemplates}>
                <Icon name="solar:bookmark-linear" size={16} color="var(--neutral-300)" />
                Templates
                {appliedTemplateCount > 0 ? <span className={styles.templateCount}>{appliedTemplateCount}</span> : null}
              </button>
            </div>
          </div>
        </div>

        {showSignedBanner && (
          <div className={styles.signedBanner}>
            <Icon name="solar:check-circle-bold" size={16} color="var(--status-success)" />
            Signed by {signedBy}{signedAt ? ` on ${new Date(signedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
          </div>
        )}
      </div>

      <div className={styles.contentBody}>
      {!carePlanLoading && planStats.total > 0 && (
        <div className={styles.summaryStrip}>
          <span className={styles.summaryMetric}><strong>{planStats.goals}</strong> Goals</span>
          <span className={styles.summaryMetric}><strong>{planStats.iv}</strong> Interventions</span>
          <span className={styles.summaryMetric}><strong>{planStats.br}</strong> Barriers</span>
          <span className={styles.summaryDivider} aria-hidden="true" />
          <span className={styles.summaryMetric}><strong>{planStats.avgProgress}%</strong> avg goal progress</span>
          <span className={styles.summaryStatuses}>
            {planStats.met > 0 && <Badge tone="success" size="S" label={`${planStats.met} Met`} />}
            {planStats.inProgress > 0 && <Badge tone="warning" size="S" label={`${planStats.inProgress} In Progress`} />}
            {planStats.overdue > 0 && <Badge tone="error" size="S" label={`${planStats.overdue} Overdue`} />}
          </span>
        </div>
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
          count={data.goals.length}
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
          <SimpleTableSkeleton rows={3} cols={7} />
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
            onLinkOwner={setLinkOwner}
            onStatusMenu={setStatusMenu}
            onRowMenu={setStatusMenu}
            linkCount={linkCount}
            emptyState={filteredGoals.length === 0 ? <div className={styles.emptyRow}>No goals match the filters.</div> : null}
          />
        ))}
      </div>

      {/* Interventions */}
      <div className={styles.section}>
        <GbiSectionHead
          title="Interventions"
          count={data.interventions.length}
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
            onLinkOwner={setLinkOwner}
            onStatusMenu={setStatusMenu}
            onRowMenu={setStatusMenu}
            onAssigneeChange={handleAssigneeChange}
            linkCount={linkCount}
            platformUsers={platformUsers}
            emptyState={filteredInterventions.length === 0 ? <div className={styles.emptyRow}>No interventions match the filters.</div> : null}
          />
        ))}
      </div>

      {/* Open Barriers */}
      <div className={styles.section}>
        <GbiSectionHead
          title="Open Barriers"
          count={(data.barriers || []).length}
          open={openSections.barriers}
          onToggle={() => toggleSection('barriers')}
          addButton={(
            <ActionButton size="S" tooltip="Add barrier" onClick={() => setAddBarriersDrawerOpen(true)} disabled={!canEdit}>
              <AddIconMinimalist size={16} color="var(--neutral-300)" />
            </ActionButton>
          )}
        />
        {renderDuplicateFlags('barrier')}
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
            onLinkOwner={setLinkOwner}
            onStatusMenu={setStatusMenu}
            onRowMenu={setStatusMenu}
            linkCount={linkCount}
            emptyState={filteredBarriers.length === 0 ? <div className={styles.emptyRow}>No barriers match the filters.</div> : null}
          />
        ))}
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
            else if (k === 'rename' && !isGoal) setPreviewIntervention(item);
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

      {previewIntervention && (
        <InterventionPreviewDrawer
          intervention={previewIntervention}
          patientId={patientId}
          program={program}
          onClose={() => setPreviewIntervention(null)}
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
        return (
          <Editor
            intervention={intvSpecialDrawer.intervention?.config}
            onClose={() => setIntvSpecialDrawer(null)}
            onSave={async (config) => {
              await saveInterventionFromConfig(
                intvSpecialDrawer.kind,
                config,
                intvSpecialDrawer.intervention?.id || null,
              );
              setIntvSpecialDrawer(null);
            }}
          />
        );
      })()}

      {taskDrawerOpen && (
        <AddTaskDrawer
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
        <Drawer
          title="Edit Barrier"
          onClose={() => setBarrierDrawer(null)}
          noCloseDivider
          headerRight={<span className={styles.headerDivider} />}
          primaryAction={<Button variant="primary" size="L" onClick={() => {
            const titleEl = document.getElementById('barrier-title-input');
            const descEl = document.getElementById('barrier-desc-input');
            const title = titleEl ? titleEl.value.trim() : '';
            const description = descEl ? descEl.value.trim() : '';
            if (!title) { showToast('Barrier title is required'); return; }
            handleAddBarrier({ title, description, status: barrierDrawer.barrier?.status || 'Not Started', priority: barrierDrawer.barrier?.priority || 'medium' });
          }}>Save</Button>}
          secondaryAction={<Button variant="secondary" size="L" onClick={() => setBarrierDrawer(null)}>Cancel</Button>}
        >
          <div className={styles.drawerBody}>
            <p className={styles.drawerHint}>Capture what blocks this patient — it will be tracked per plan and appear in the audit history.</p>
            <div className={styles.drawerField}>
              <span className={styles.drawerLabel}>Title <span className={styles.required}>*</span></span>
              <Input id="barrier-title-input" defaultValue={barrierDrawer.barrier?.title || ''} placeholder="e.g. Transportation — no ride to clinic" aria-label="Barrier title" />
            </div>
            <div className={styles.drawerField}>
              <span className={styles.drawerLabel}>Description</span>
              <Textarea id="barrier-desc-input" defaultValue={barrierDrawer.barrier?.description || ''} placeholder="Add details about this barrier" rows={3} />
            </div>
          </div>
        </Drawer>
      )}

      {conditionsViewOpen && (
        <Drawer title="All Conditions" onClose={() => setConditionsViewOpen(false)} noCloseDivider headerRight={<span className={styles.headerDivider} />}>
          <div className={styles.drawerBody}>
            <p className={styles.drawerHint}>{data.conditionTotal} conditions on this plan — {data.conditions.length} shown in the header. Remove any chip above or manage them here.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {data.conditions.map(c => {
                const count = conditionCounts.get(c.label) ?? 0;
                const isAlert = !!(c.primary || c.alert);
                return (
                <span key={c.label} className={`${styles.chip} ${isAlert ? styles.chipAlert : styles.chipDefault}`}>
                  <span className={styles.chipLabel}>{c.label}</span>
                  <span className={styles.chipCount}>{count}</span>
                  <button type="button" className={styles.chipRemove} onClick={() => handleRemoveCondition(c.label)} aria-label={`Remove ${c.label}`} disabled={!canEdit}>
                    <Icon name="solar:close-linear" size={16} color="var(--neutral-300)" />
                  </button>
                </span>
              );})}
            </div>
          </div>
        </Drawer>
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
          title="Add Note"
          onClose={() => setNoteOpen(false)}
          secondaryAction={<Button variant="secondary" size="L" onClick={() => setNoteOpen(false)}>Cancel</Button>}
          primaryAction={<Button variant="primary" size="L" onClick={doAddNote} disabled={!noteText.trim()}>Add Note</Button>}
        >
          <div className={styles.drawerBody}>
            <p className={styles.drawerHint}>Records a maintenance note on the signed plan without editing it — it appears in the plan's History.</p>
            <div className={styles.drawerField}>
              <span className={styles.drawerLabel}>Note <span className={styles.required}>*</span></span>
              <Textarea autoFocus value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="e.g. Reviewed with patient; no changes needed." rows={3} />
            </div>
          </div>
        </Drawer>
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

      {deleteTarget && (
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
