import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/Icon/Icon';
import { AddIconMinimalist } from '@/components/Icon/AddIconMinimalist';
import { ActionButton } from '@/components/ActionButton/ActionButton';
import { MenuPopover } from '@/components/MenuPopover/MenuPopover';
import { goalCascade, barrierGoalIdsOf } from '../lib/carePlanGoalCascade';
import { Select } from '@/components/Select/Select';
import { FilterChip } from '@/components/FilterChip/FilterChip';
import {
  GBI_STATUSES,
  PRIORITY_LABELS,
  GbiSectionHead,
  SectionEmptyState,
} from './CarePlanViewSections';
import { useCarePlanViewData } from './useCarePlanViewData';
import { useCarePlanViewFetchEffects } from './useCarePlanViewFetchEffects';
import { useCarePlanViewPanelRequest } from './useCarePlanViewPanelRequest';
import { useCarePlanOpenSections } from './useCarePlanOpenSections';
import { useCarePlanNoteDrawer } from './useCarePlanNoteDrawer';
import { useCarePlanViewFilters } from './useCarePlanViewFilters';
import { linkedForGoal, linkedForChild } from './carePlanLinkedItems';
import {
  CARE_PLAN_INTERVENTION_MENU,
  buildInterventionRecordFromConfig,
} from '../lib/carePlanInterventionMenu';
import { deriveGoalTableFields } from '../lib/goalMetrics';
import { CarePlanGoalsTable } from '../tables/CarePlanGoalsTable';
import { CarePlanInterventionsTable } from '../tables/CarePlanInterventionsTable';
import { CarePlanBarriersTable } from '../tables/CarePlanBarriersTable';
import { RingEmptyState } from '@/components/RingEmptyState/RingEmptyState';
import { SimpleTableSkeleton } from '@/components/SimpleTableSkeleton/SimpleTableSkeleton';
import { DownChevronIcon } from '@/components/Icon/DownChevronIcon';
import { BulkBar } from '@/components/BulkBar/BulkBar';
import { Badge } from '@/components/Badge/Badge';
import { CarePlanDuplicateGroup } from '../DuplicateFlag/CarePlanDuplicateGroup';
import { CarePlanViewDrawers } from './CarePlanViewDrawers';
import { CarePlanViewOverlays } from './CarePlanViewOverlays';
import { AppliedTemplateStrip } from './AppliedTemplateStrip';
import { addGoalsFromPicker, addBarriersFromPicker } from './carePlanPickerHandlers';
import {
  createUndoGoalCascadeAction,
  createUndoToastAction,
  deleteGbiById as deleteGbiByIdAction,
  saveGbiPriority,
  saveGbiStatus,
} from './carePlanGbiActions';
import { useCarePlanBulkSelection } from './useCarePlanBulkSelection';
import styles from './CarePlanView.module.css';

export function CarePlanView({ patientId, program }) {
  const {
    key,
    live,
    auditAll,
    duplicateFlags,
    carePlanLoading,
    latestPlanNote,
    noteTimelineEntries,
    patientName,
    patientProblems,
    platformUsers,
    bulkMode,
    setCarePlanBulkMode,
    carePlanShareRequest,
    clearCarePlanShareRequest,
    carePlanPanelRequest,
    clearCarePlanPanelRequest,
    carePlanTemplates,
    libraryGoals,
    fetchPatientCarePlan,
    fetchCarePlanLinks,
    fetchCarePlanLibrary,
    refreshCarePlanDuplicates,
    dismissCarePlanDuplicate,
    savePatientCarePlanAsTemplate,
    signCarePlan,
    addCarePlanNote,
    logCarePlanAudit,
    showToast,
    savePatientCarePlanGoal,
    deletePatientCarePlanGoal,
    savePatientCarePlanIntervention,
    deletePatientCarePlanIntervention,
    savePatientCarePlanBarrier,
    deletePatientCarePlanBarrier,
    repairCarePlanGoalLinks,
    syncAppliedCarePlanTemplates,
    applyPatientCarePlanTemplates,
    savePatientCarePlanConditions,
  } = useCarePlanViewData(patientId, program);
  const [linkOwner, setLinkOwner] = useState(null); // null | { kind, item }
  // Linked-items preview data (Figma SNP-Story 2632:112808). A goal links its
  // interventions/barriers/automations (by goalId); a child row links its goal.
  const programBadge = program?.name ? [program.name] : (program?.code ? [program.code] : []);
  const linkedForGoalRow = (g) => linkedForGoal(g, live, programBadge);
  const linkedForChildRow = (item) => linkedForChild(item, live, programBadge);

  useCarePlanViewFetchEffects({
    patientId,
    program,
    live,
    libraryGoals,
    fetchPatientCarePlan,
    fetchCarePlanLinks,
    refreshCarePlanDuplicates,
    fetchCarePlanLibrary,
    syncAppliedCarePlanTemplates,
    repairCarePlanGoalLinks,
    clearCarePlanShareRequest,
  });

  // No persisted plan yet
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
  const { openSections, toggleSection } = useCarePlanOpenSections();
  // Which section's duplicate flags are expanded — { goal: bool, intervention: bool, barrier: bool }.
  // Default collapsed; clicking the section-header duplicates badge toggles the panel.
  const [expandedDuplicates, setExpandedDuplicates] = useState({});
  const toggleDuplicates = (kind) => setExpandedDuplicates(s => ({ ...s, [kind]: !s[kind] }));
  const [statusMenu, setStatusMenu] = useState(null); // { kind, item, rect }
  const [priorityMenu, setPriorityMenu] = useState(null); // { kind, item, rect }
  const [addGoalsDrawerOpen, setAddGoalsDrawerOpen] = useState(false);
  const [addBarriersDrawerOpen, setAddBarriersDrawerOpen] = useState(false);
  const [previewGoal, setPreviewGoal] = useState(null);
  const [previewIntervention, setPreviewIntervention] = useState(null);
  const [intvDrawer, setIntvDrawer] = useState(null);  // false | { intervention }
  const [intvTypeMenuOpen, setIntvTypeMenuOpen] = useState(false);
  const [intvSpecialDrawer, setIntvSpecialDrawer] = useState(null); // null | { kind, intervention?, presetGoalId? }
  const [taskDrawerOpen, setTaskDrawerOpen] = useState(null); // null | 'patient-task' | 'internal-task'
  const intvAddRef = useRef(null);
  // Row-menu "Add Intervention" (goal row): the intervention-type submenu
  // anchored at the row, carrying the goal to pre-link the new item onto.
  const [intvTypeMenu, setIntvTypeMenu] = useState(null); // null | { rect, goalId }
  // Goal a row-menu "Add …" is scoped to, so the new item pre-links to it.
  const [taskGoalId, setTaskGoalId] = useState(null);
  // Goal a row-menu "Add Barrier" is scoped to. Only read inside handlers
  // (never rendered), so a ref avoids a needless re-render when it is set.
  const barrierAddGoalIdRef = useRef(null);
  // Row-menu "Link existing …": checkbox popover staged against a goal.
  const [linkPopover, setLinkPopover] = useState(null); // null | { kind, goalId, rect, selected:Set }
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
  const {
    noteOpen,
    noteText,
    setNoteText,
    noteDiscardOpen,
    setNoteDiscardOpen,
    noteDeleteOpen,
    setNoteDeleteOpen,
    noteDirty,
    openNoteDrawer,
    closeNoteDrawer,
  } = useCarePlanNoteDrawer(latestPlanNote);
  const {
    filtersOpen,
    setFiltersOpen,
    filters,
    setFilter,
    clearFilters,
    filtersActive,
    assigneeOptions,
    filteredGoals,
    filteredBarriers,
    filteredInterventions,
    planStats,
    templateGoalCounts,
  } = useCarePlanViewFilters({
    data,
    templateFilterId,
    carePlanTemplates,
    libraryGoals,
  });

  const canEdit = !!(patientId && program);
  const {
    selected,
    bulkMenu,
    setBulkMenu,
    bulkDeleteOpen,
    setBulkDeleteOpen,
    bulkAssignOpen,
    setBulkAssignOpen,
    selectedCount,
    toggleSelect,
    clearSelection,
    selectAllKind,
    bulkSetStatus,
    bulkSetPriority,
    bulkAssign,
    bulkDelete,
    gbiCtx,
  } = useCarePlanBulkSelection({
    bulkMode,
    setCarePlanBulkMode,
    filteredGoals,
    filteredInterventions,
    filteredBarriers,
    patientId,
    program,
    savePatientCarePlanGoal,
    savePatientCarePlanIntervention,
    savePatientCarePlanBarrier,
    deletePatientCarePlanGoal,
    deletePatientCarePlanIntervention,
    deletePatientCarePlanBarrier,
    refreshCarePlanDuplicates,
    showToast,
  });

  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateConditions, setTemplateConditions] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null); // { kind, id, name }
  const [historyOpen, setHistoryOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [signNote, setSignNote] = useState('');

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
    closeNoteDrawer({ force: true });
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
    saveGbiStatus({
      kind,
      item,
      status,
      patientId,
      program,
      savePatientCarePlanGoal,
      savePatientCarePlanBarrier,
      savePatientCarePlanIntervention,
    });
  };

  const changePriority = (priority) => {
    const { kind, item } = priorityMenu;
    setPriorityMenu(null);
    saveGbiPriority({
      kind,
      item,
      priority,
      patientId,
      program,
      savePatientCarePlanGoal,
      savePatientCarePlanBarrier,
      savePatientCarePlanIntervention,
    });
  };

  const renameBarrier = (barrier, title) => savePatientCarePlanBarrier(patientId, program, { ...barrier, title }, barrier.id);

  // A picked row is the whole library goal, so a goal added here carries the
  // same definition (measure, target, duration) and the same linked items as
  // one arriving through a template.
  const handleAddGoalsFromPicker = async (picked, removed = []) => {
    setAddGoalsDrawerOpen(false);
    await addGoalsFromPicker({
      picked,
      removed,
      data,
      patientId,
      program,
      savePatientCarePlanGoal,
      deletePatientCarePlanGoal,
      savePatientCarePlanBarrier,
      savePatientCarePlanIntervention,
      refreshCarePlanDuplicates,
      showToast,
    });
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

  const saveInterventionFromConfig = async (kind, config, editingId = null, preLinkedGoalId = null) => {
    const record = buildInterventionRecordFromConfig(kind, config, { editing: !!editingId, preLinkedGoalId });
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
    const linkGoalId = barrierAddGoalIdRef.current;
    barrierAddGoalIdRef.current = null;
    await addBarriersFromPicker({
      picked,
      opts,
      linkGoalId,
      data,
      patientId,
      program,
      savePatientCarePlanBarrier,
      refreshCarePlanDuplicates,
      showToast,
    });
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
  const undoGoalCascade = (goal, cascade) => createUndoGoalCascadeAction(goal, cascade, gbiCtx);

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
    const undoKind = kind === 'intv' ? 'intervention' : kind;
    showToast(`"${name}" removed`, item ? {
      action: createUndoToastAction([{ kind: undoKind, item }], gbiCtx),
      duration: 6000,
    } : undefined);
  };

  const deleteGbiById = (kind, id) => deleteGbiByIdAction(kind, id, gbiCtx);
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

  const panelActionsRef = useRef(null);
  useLayoutEffect(() => {
    panelActionsRef.current = {
      setVersionsOpen,
      setTemplateName,
      setTemplateConditions,
      setTemplateOpen,
      setTemplatesDrawerOpen,
      setHistoryOpen,
      setFiltersOpen,
      openNoteDrawer,
      setSignNote,
      setSignOpen,
      scanForDuplicates,
      planConditions: live?.plan?.conditions || [],
    };
  });
  useCarePlanViewPanelRequest(carePlanPanelRequest, clearCarePlanPanelRequest, panelActionsRef);

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
  const flagsForKind = (kind) => duplicateFlags.filter(f => f.kind === kind);
  // Section-header duplicate badge: renders inline next to the title as a
  // secondary Badge and toggles the CarePlanDuplicateGroup panel below.
  // Nothing renders when the kind has no open duplicate flags.
  const renderDuplicateBadge = (kind) => {
    const flags = flagsForKind(kind);
    if (!flags.length) return null;
    const expanded = !!expandedDuplicates[kind];
    return (
      <button
        type="button"
        className={styles.duplicateBadgeBtn}
        onClick={() => toggleDuplicates(kind)}
        aria-expanded={expanded}
        aria-label={`${flags.length} possible duplicate${flags.length === 1 ? '' : 's'}`}
      >
        <Badge
          tone="secondary"
          size="S"
          icon="solar:danger-triangle-linear"
          label={`${flags.length} possible duplicate${flags.length === 1 ? '' : 's'}`}
        />
      </button>
    );
  };
  // Expanded panel — hides the group's own summary since the section-header
  // badge already surfaces the count.
  const renderDuplicateFlags = (kind) => {
    const flags = flagsForKind(kind);
    if (!flags.length || !expandedDuplicates[kind]) return null;
    return (
      <CarePlanDuplicateGroup
        flags={flags}
        hideSummary
        onIgnore={handleDuplicateIgnore}
        onAcceptExisting={handleDuplicateAcceptExisting}
        onAcceptNew={handleDuplicateAcceptNew}
        onEditExisting={handleDuplicateEditExisting}
      />
    );
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
    const saved = await savePatientCarePlanAsTemplate(patientId, program, templateName, templateConditions);
    setTemplateOpen(false);
    setTemplateName('');
    setTemplateConditions([]);
    if (saved) showToast(`Saved as template "${saved.name}"`);
  };

  const rowMenuItems = (kind) => {
    const edit = { key: 'rename', icon: 'solar:pen-linear', label: 'Edit', disabled: !canEdit };
    const del = { key: 'delete', icon: 'solar:trash-bin-trash-linear', label: 'Delete', danger: true, disabled: !canEdit };
    if (kind !== 'goal-menu') return [edit, del];
    // Goal rows can grow the plan directly: add or link interventions and
    // barriers onto this goal without opening the Goal Details drawer.
    return [
      edit,
      { divider: true },
      { key: 'add-intv', icon: 'solar:checklist-minimalistic-linear', label: 'Add Intervention', disabled: !canEdit },
      { key: 'link-intv', icon: 'solar:link-linear', label: 'Link Existing Intervention', disabled: !canEdit },
      { key: 'add-barrier', icon: 'solar:signpost-2-linear', label: 'Add Barrier', disabled: !canEdit },
      { key: 'link-barrier', icon: 'solar:link-linear', label: 'Link Existing Barrier', disabled: !canEdit },
      { divider: true },
      del,
    ];
  };

  // Interventions / barriers not yet on this goal, shaped for the
  // "Link existing" checkbox popover. An intervention lives on a single
  // goal, so already-linked ones note where they'd move from.
  const linkCandidates = (kind, goalId) => {
    const gid = String(goalId);
    if (kind === 'intervention') {
      const goalTitle = new Map((data.goals || []).map(g => [String(g.id), g.title]));
      return (data.interventions || [])
        .filter(i => String(i.goalId) !== gid)
        .map(i => ({
          id: i.id,
          title: i.title,
          subtitle: i.goalId ? `Linked to ${goalTitle.get(String(i.goalId)) || 'another goal'}` : (i.status || 'Not Started'),
        }));
    }
    return (data.barriers || [])
      .filter(b => !barrierGoalIdsOf(b).some(x => String(x) === gid))
      .map(b => ({ id: b.id, title: b.title, subtitle: b.status || 'Not Started' }));
  };

  const confirmLinkExisting = async () => {
    if (!linkPopover) return;
    const { kind, goalId, selected } = linkPopover;
    const ids = [...selected];
    setLinkPopover(null);
    if (!ids.length || !canEdit) return;
    // The selected items are distinct rows linking to the same goal, so the
    // writes are independent — run them together. Each item is resolved by a
    // Map lookup rather than a per-id array scan.
    if (kind === 'intervention') {
      const byId = new Map((data.interventions || []).map(i => [i.id, i]));
      await Promise.all(ids.map((id) => {
        const intv = byId.get(id);
        return intv ? savePatientCarePlanIntervention(patientId, program, { ...intv, goalId }, intv.id) : null;
      }));
    } else {
      const byId = new Map((data.barriers || []).map(b => [b.id, b]));
      await Promise.all(ids.map((id) => {
        const barrier = byId.get(id);
        if (!barrier) return null;
        const nextIds = [...new Set([...barrierGoalIdsOf(barrier).map(String), String(goalId)])];
        return savePatientCarePlanBarrier(patientId, program, { ...barrier, goalIds: nextIds, goalId: nextIds[0] || null }, barrier.id);
      }));
    }
    showToast(`Linked ${ids.length} ${kind}${ids.length === 1 ? '' : 's'} to the goal`);
  };

  const overlayProps = {
    statusMenu, changeStatus, setStatusMenu,
    bulkMenu, bulkSetPriority, bulkSetStatus, setBulkMenu,
    linkOwner, patientId, program, patientName, setLinkOwner,
    rowMenuItems, intvTypeMenu, setIntvTypeMenu, setTaskGoalId, setTaskDrawerOpen, setIntvSpecialDrawer,
    linkPopover, linkCandidates, setLinkPopover, confirmLinkExisting,
    priorityMenu, changePriority, setPriorityMenu,
    barrierAddGoalIdRef, setAddBarriersDrawerOpen, setDeleteTarget, setBarrierDrawer, showToast,
  };

  const drawerProps = {
    addGoalsDrawerOpen, setAddGoalsDrawerOpen, handleAddGoalsFromPicker, data, patientProblems,
    previewGoal, setPreviewGoal, patientId, program, previewBarrier, setPreviewBarrier,
    previewIntervention, setPreviewIntervention, intvDrawer, setIntvDrawer, handleAddIntervention,
    intvSpecialDrawer, setIntvSpecialDrawer, auditAll, saveInterventionFromConfig,
    taskDrawerOpen, setTaskDrawerOpen, taskGoalId, setTaskGoalId, patientName,
    addBarriersDrawerOpen, setAddBarriersDrawerOpen, barrierAddGoalIdRef, handleAddBarriersFromPicker,
    barrierDrawer, setBarrierDrawer, handleAddBarrier, shareOpen, clearCarePlanShareRequest, canEdit,
    historyOpen, setHistoryOpen, versionsOpen, setVersionsOpen, signOpen, setSignOpen, doSign, signNote, setSignNote,
    noteOpen, closeNoteDrawer, doAddNote, noteText, setNoteText, noteDirty, latestPlanNote, noteTimelineEntries,
    noteDiscardOpen, setNoteDiscardOpen, noteDeleteOpen, setNoteDeleteOpen, doClearCareNote,
    problemOpen, setProblemOpen, doAddProblem, problemText, setProblemText,
    trendsOpen, setTrendsOpen, measurements,
    templatesDrawerOpen, setTemplatesDrawerOpen, appliedTemplateIds, appliedTemplatePriorities, handleApplyTemplates,
    templateOpen, setTemplateOpen, templateName, setTemplateName, templateConditions, setTemplateConditions, saveTemplate,
    deleteTarget, setDeleteTarget, live, removeGoal, confirmDelete,
    bulkAssignOpen, setBulkAssignOpen, bulkAssign, bulkDeleteOpen, setBulkDeleteOpen, bulkDelete, selectedCount,
  };

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
          rightAccessory={renderDuplicateBadge('goal')}
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
            linked={linkedForGoalRow}
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
          rightAccessory={renderDuplicateBadge('intervention')}
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
            linked={linkedForChildRow}
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
          rightAccessory={renderDuplicateBadge('barrier')}
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
            onStatusMenu={setStatusMenu}
            onRowMenu={setStatusMenu}
            onOpenBarrier={setPreviewBarrier}
            linked={linkedForChildRow}
            emptyState={filteredBarriers.length === 0 ? <div className={styles.emptyRow}>No barriers match the filters.</div> : null}
          />
        ))}
      </div>
      </div>
      </div>

      <CarePlanViewOverlays {...overlayProps} />

      <CarePlanViewDrawers {...drawerProps} />
    </div>
  );
}
