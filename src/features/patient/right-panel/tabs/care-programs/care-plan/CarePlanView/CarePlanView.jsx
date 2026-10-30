import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../../../../../../store/useAppStore';
import { uniqueById } from '../lib/carePlanDraft';
import { Icon } from '@/components/Icon/Icon';
import { AddIconMinimalist } from '@/components/Icon/AddIconMinimalist';
import { ActionButton } from '@/components/ActionButton/ActionButton';
import { Button } from '@/components/Button/Button';
import { Alert } from '@/components/Alert/Alert';
import { PauseCarePlanDialog } from '../drawers/PauseCarePlanDialog/PauseCarePlanDialog';
import { CarePlanPausedContext } from '../lib/carePlanPausedContext';
import { fmtCarePlanDate } from '../tables/carePlanTableModel';
import { isCarePlanPaused, pauseSummary } from '../lib/carePlanPause';
import { pendingRecommendation } from '../lib/carePlanRecommendation';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import { IndividualizedPlanCard } from '../ai/IndividualizedPlanCard';
import { AiReviewContext } from '../ai/aiReviewContext';
import { MenuPopover } from '@/components/MenuPopover/MenuPopover';
import { goalCascade, barrierGoalIdsOf } from '../lib/carePlanGoalCascade';
import { Select } from '@/components/Select/Select';
import { FilterChip } from '@/components/FilterChip/FilterChip';
import { ALL_GBI_STATUSES } from '../lib/gbiStatus';
import {
  PRIORITY_LABELS,
  GbiSectionHead,
  SectionEmptyState,
  SectionTitle,
} from './CarePlanViewSections';
import { useCarePlanViewData } from './useCarePlanViewData';
import { useCarePlanViewFetchEffects } from './useCarePlanViewFetchEffects';
import { useCarePlanViewPanelRequest } from './useCarePlanViewPanelRequest';
import { useCarePlanOpenSections } from './useCarePlanOpenSections';
import { useCarePlanNoteDrawer } from './useCarePlanNoteDrawer';
import { useCarePlanViewFilters } from './useCarePlanViewFilters';
import { linkedForGoal, linkedForChild, noteSummaryLookup } from './carePlanLinkedItems';
import { norm } from './carePlanViewNorm';
import {
  CARE_PLAN_INTERVENTION_MENU,
  buildInterventionRecordFromConfig,
} from '../lib/carePlanInterventionMenu';
import { deriveGoalTableFields } from '../lib/goalMetrics';
import { CarePlanGoalsTable } from '../tables/CarePlanGoalsTable';
import { CarePlanInterventionsTable } from '../tables/CarePlanInterventionsTable';
import { CarePlanBarriersTable } from '../tables/CarePlanBarriersTable';
import { SdohSection } from '../sdoh/SdohSection';
import { SdohReferralDialog } from '../sdoh/SdohReferralDialog';
import { isSdohBarrier, referralInterventionFields, sdohBarrierFields } from '../lib/sdohTaxonomy';
import { RingEmptyState } from '@/components/RingEmptyState/RingEmptyState';
import { SimpleTableSkeleton } from '@/components/SimpleTableSkeleton/SimpleTableSkeleton';
import { BulkBar } from '@/components/BulkBar/BulkBar';
import { Badge } from '@/components/Badge/Badge';
import { CarePlanDuplicatePopover } from '../DuplicateFlag/CarePlanDuplicatePopover';
import { CarePlanViewDrawers } from './CarePlanViewDrawers';
import { CarePlanViewOverlays } from './CarePlanViewOverlays';
import { AppliedTemplateStrip } from './AppliedTemplateStrip';
import { useCarePlanEpisodes } from './useCarePlanEpisodes';
import { CarePlanLinkageSection } from './CarePlanLinkageSection';
import { CarePlanAiSummarySection } from './CarePlanAiSummarySection';
import { addGoalsFromPicker, addBarriersFromPicker } from './carePlanPickerHandlers';
import { formatInstanceDate } from '../lib/templateRenewal';
import {
  createUndoGoalCascadeAction,
  createUndoToastAction,
  deleteGbiById as deleteGbiByIdAction,
  saveGbiPriority,
  saveGbiStatus,
} from './carePlanGbiActions';
import { useCarePlanBulkSelection } from './useCarePlanBulkSelection';
import { CategorySuggestionBanner } from './CategorySuggestionBanner';
import { categorySuggestions, hasCategories } from '../../../../../../settings/care-plan-library/lib/templateCategories';
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
  const layout = useAppStore(s => s.carePlanLayout);
  // Linked-items preview data (Figma SNP-Story 2632:112808). A goal links its
  // interventions/barriers/automations (by goalId); a child row links its goal.
  const programBadge = program?.name ? [program.name] : (program?.code ? [program.code] : []);
  const linkedForGoalRow = (g) => linkedForGoal(g, live, programBadge);
  const linkedForChildRow = (item) => linkedForChild(item, live, programBadge);
  // Notes action: the item's note count, highlighted when one is new to this
  // user; the click opens that item's drawer scrolled to its Note section.
  const noteReads = useAppStore(s => s.carePlanNoteReads);
  const fetchCarePlanNoteReads = useAppStore(s => s.fetchCarePlanNoteReads);
  const markCarePlanNoteSeen = useAppStore(s => s.markCarePlanNoteSeen);
  const myName = useAppStore(s => s.currentUserProfile?.name || '');
  useEffect(() => { fetchCarePlanNoteReads(); }, [fetchCarePlanNoteReads]);
  const noteLookup = useMemo(() => noteSummaryLookup(auditAll, noteReads, myName), [auditAll, noteReads, myName]);
  const [notesFocus, setNotesFocus] = useState(null); // null | { kind, id }

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
  // Which section's duplicate flags are expanded: { goal: bool, intervention: bool, barrier: bool }.
  // Default collapsed; clicking the section-header duplicates badge toggles the panel.
  // The section whose duplicates popover is open: { kind, rect } or null.
  const [duplicatesOpen, setDuplicatesOpen] = useState(null);
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
  // Opening an item's drawer shows its notes, so they're no longer new.
  useEffect(() => { if (previewGoal?.id) markCarePlanNoteSeen('goal', previewGoal.id); }, [previewGoal?.id, markCarePlanNoteSeen]);
  useEffect(() => { if (previewIntervention?.id) markCarePlanNoteSeen('intervention', previewIntervention.id); }, [previewIntervention?.id, markCarePlanNoteSeen]);
  useEffect(() => { if (previewBarrier?.id) markCarePlanNoteSeen('barrier', previewBarrier.id); }, [previewBarrier?.id, markCarePlanNoteSeen]);
  const openNotesFor = (kind, item) => {
    setNotesFocus({ kind, id: item.id });
    if (kind === 'goal') setPreviewGoal(item);
    else if (kind === 'intervention') setPreviewIntervention(item);
    else setPreviewBarrier(item);
  };
  const [templatesDrawerOpen, setTemplatesDrawerOpen] = useState(false);
  // A template already on the plan, being extended or reinstated.
  const [applyAgainTemplate, setApplyAgainTemplate] = useState(null);
  // Apply Templates → Create New: the library editor opens over the plan, and
  // a template saved there comes back pre-checked in the reopened drawer.
  const [templateCreateOpen, setTemplateCreateOpen] = useState(false);
  const [createdTemplateIds, setCreatedTemplateIds] = useState([]);
  // Applied-template filter: clicking a template badge in the sticky bar
  // scopes goals / interventions / barriers to items that came from that
  // template. Click again (or another badge) to swap; the "+N more" chip
  // clears it. Null means show everything.
  const [templateFilterId, setTemplateFilterId] = useState(null);

  // Templates added again: each earlier (auto-closed) run in order, the
  // current run's version after them. Feeds the strip's V1 ✓ / V2 chips.
  const runsByTemplate = useMemo(() => {
    const out = {};
    for (const inst of live?.templateInstances || []) {
      if (!inst.autoClosed) continue;
      const entry = (out[inst.templateId] ||= { previous: [] });
      entry.previous.push({ id: inst.id, status: inst.status, version: entry.previous.length + 1, closeReason: inst.closeReason, categoryName: inst.categoryName });
    }
    for (const entry of Object.values(out)) entry.version = entry.previous.length + 1;
    return out;
  }, [live?.templateInstances]);
  // The template version each active run is on, the newer one it is waiting
  // to move to (published with "next review" or a future date), and the
  // template category it went on with.
  const templateVersionChains = useAppStore(s => s.carePlanTemplateVersions);
  const templateVersionInfo = useMemo(() => {
    const out = {};
    for (const inst of live?.templateInstances || []) {
      if (inst.status !== 'active') continue;
      const category = inst.categoryName || '';
      if (!inst.templateVersionNumber) {
        if (category) out[inst.templateId] = { pending: false, category, title: `Category: ${category}` };
        continue;
      }
      const pending = inst.pendingVersionId
        && (templateVersionChains[inst.templateId] || []).find(v => v.id === inst.pendingVersionId);
      const when = pending && (inst.pendingMode === 'review'
        ? 'at the next completed review'
        : `when opened on or after ${inst.pendingEffectiveDate?.slice(5, 7)}/${inst.pendingEffectiveDate?.slice(8, 10)}/${inst.pendingEffectiveDate?.slice(0, 4)}`);
      out[inst.templateId] = {
        pending: !!pending,
        category,
        title: `${category ? `Category: ${category}. ` : ''}Template version ${inst.templateVersionNumber}${pending ? `. Version ${pending.versionNumber} applies ${when}.` : ''}`,
      };
    }
    return out;
  }, [live?.templateInstances, templateVersionChains]);
  // An earlier run picked on the strip (`run:<id>`): its own goals,
  // interventions and barriers, shown read-only in the same tables.
  const viewedRun = useMemo(() => {
    if (typeof templateFilterId !== 'string' || !templateFilterId.startsWith('run:')) return null;
    const id = templateFilterId.slice(4);
    const run = (live?.templateInstances || []).find(i => i.id === id);
    if (!run) return null;
    const own = x => x.retiredInstanceId === id;
    const r = live?.retired || {};
    return {
      run,
      version: Object.values(runsByTemplate).flatMap(e => e.previous).find(p => p.id === id)?.version,
      data: {
        ...data,
        goals: (r.goals || []).filter(own).map(g => ({ ...g, ...deriveGoalTableFields(g, []) })),
        interventions: (r.interventions || []).filter(own),
        barriers: (r.barriers || []).filter(own),
      },
    };
  }, [templateFilterId, live?.templateInstances, live?.retired, data, runsByTemplate]);
  // A past version picked in Version History: its snapshot, read only.
  const carePlanKey = patientId && program?.id ? `${patientId}::${program.id}` : null;
  const viewedVersion = useAppStore(s => (carePlanKey ? s.viewedCarePlanVersion[carePlanKey] : null));
  const setViewedCarePlanVersion = useAppStore(s => s.setViewedCarePlanVersion);
  // Leaving the plan returns it to the live version.
  useEffect(() => () => { if (carePlanKey) setViewedCarePlanVersion(carePlanKey, null); }, [carePlanKey, setViewedCarePlanVersion]);
  const versionData = useMemo(() => {
    if (!viewedVersion) return null;
    const s = viewedVersion.snapshot || {};
    return {
      conditions: (s.conditions || []).map(c => (typeof c === 'string' ? { label: c } : c)),
      conditionTotal: (s.conditions || []).length,
      goals: uniqueById(s.goals).map(g => ({ ...g, ...deriveGoalTableFields(g, []) })),
      interventions: uniqueById(s.interventions),
      barriers: uniqueById(s.barriers),
    };
  }, [viewedVersion]);
  const viewData = versionData || (viewedRun ? viewedRun.data : data);
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
  } = useCarePlanViewFilters({
    data: viewData,
    templateFilterId: viewedRun || versionData ? null : templateFilterId,
    carePlanTemplates,
    libraryGoals,
    patientName,
  });
  // SDOH needs get their own section; the Barriers table lists the rest.
  const sdohBarriers = useMemo(() => filteredBarriers.filter(isSdohBarrier), [filteredBarriers]);
  const plainBarriers = useMemo(() => filteredBarriers.filter(b => !isSdohBarrier(b)), [filteredBarriers]);

  // An earlier run is history: shown, not edited.
  const canEdit = !!(patientId && program) && !viewedRun && !versionData;
  // Episodic templates: Start Episode before applying, then a banner while it runs.
  const episodes = useCarePlanEpisodes({
    patientId, program, live, canEdit,
    readOnly: !!(viewedRun || viewedVersion),
    applyTemplates: (ids, priorities, categoryPicks) => applyPatientCarePlanTemplates(patientId, program, ids, priorities, categoryPicks),
  });

  // Template runs whose patient now matches a different category (switch suggestion).
  const criteriaInputs = useAppStore(s => (patientId ? s.patientCriteriaInputs[patientId] : null));
  const fetchPatientCriteriaInputs = useAppStore(s => s.fetchPatientCriteriaInputs);
  const switchCarePlanTemplateCategory = useAppStore(s => s.switchCarePlanTemplateCategory);
  const dismissCarePlanCategorySuggestion = useAppStore(s => s.dismissCarePlanCategorySuggestion);
  const watchesCategories = useMemo(() => (live?.templateInstances || []).some(i => i.status === 'active'
    && hasCategories(carePlanTemplates.find(t => String(t.id) === String(i.templateId)))), [live?.templateInstances, carePlanTemplates]);
  useEffect(() => {
    if (watchesCategories && patientId) fetchPatientCriteriaInputs(patientId);
  }, [watchesCategories, patientId, fetchPatientCriteriaInputs]);
  const categoryHints = useMemo(
    () => categorySuggestions(live?.templateInstances, carePlanTemplates, criteriaInputs),
    [live?.templateInstances, carePlanTemplates, criteriaInputs],
  );
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
  // 'all' = the whole plan; otherwise the id of one applied template.
  const [templateSourceId, setTemplateSourceId] = useState('all');
  // Saved from a patient's plan, so it defaults to that patient.
  const [templateScope, setTemplateScope] = useState('patient');
  const [deleteTarget, setDeleteTarget] = useState(null); // { kind, id, name }
  // SDOH (lib/sdohTaxonomy): needs are barriers with a domain, shown in their
  // own section; a referral is an 'sdoh-referral' intervention on the need.
  const [referralFor, setReferralFor] = useState(null); // { barrier, partner }
  const savePatientCarePlanBarrierSdoh = useAppStore(s => s.savePatientCarePlanBarrier);
  const savePatientCarePlanInterventionSdoh = useAppStore(s => s.savePatientCarePlanIntervention);
  const addSdohNeed = async (needKey) => {
    const fields = sdohBarrierFields(needKey);
    if (!fields) return;
    const saved = await savePatientCarePlanBarrierSdoh(patientId, program, { ...fields, status: 'Not Started', priority: 'medium', goalIds: [] });
    if (saved) showToast(`Added "${fields.title}"`);
  };
  const saveReferral = async ({ partner, program: programName, note, status }) => {
    const { barrier } = referralFor;
    setReferralFor(null);
    const saved = await savePatientCarePlanInterventionSdoh(patientId, program, referralInterventionFields({ partner, barrier, program: programName, note, status }));
    if (saved) showToast('Referral recorded');
  };
  const setReferralStatus = (referral, referralStatus) => savePatientCarePlanInterventionSdoh(
    patientId, program,
    // A completed or declined referral closes the intervention; the need's own
    // status is the care manager's call.
    { config: { referralStatus }, status: referralStatus === 'Completed' ? 'Met' : referralStatus === 'Declined' ? 'Not Met' : 'In Progress' },
    referral.id,
  );
  const [historyOpen, setHistoryOpen] = useState(false);
  // Pause (lib/carePlanPause): the live plan only, never an older version.
  const [pauseOpen, setPauseOpen] = useState(false);
  const pauseCarePlan = useAppStore(s => s.pauseCarePlan);
  const resumeCarePlan = useAppStore(s => s.resumeCarePlan);
  const planPaused = !viewedVersion && isCarePlanPaused(live?.plan);
  const submitPause = async (form) => {
    setPauseOpen(false);
    if (await pauseCarePlan(patientId, program, form)) showToast('Care plan paused');
  };
  const resumePlan = async () => {
    if (await resumeCarePlan(patientId, program)) showToast('Care plan resumed');
  };
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [signNote, setSignNote] = useState('');

  // A past version shows the templates it had.
  const appliedTemplateIds = (viewedVersion ? viewedVersion.snapshot?.appliedTemplateIds : live?.plan?.appliedTemplateIds) || [];
  const appliedTemplatePriorities = (viewedVersion ? viewedVersion.snapshot?.appliedTemplatePriorities : live?.plan?.appliedTemplatePriorities) || {};
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
  // Templates no longer on the plan whose earlier runs (an ended episode)
  // still show on the strip.
  const liveAppliedIds = live?.plan?.appliedTemplateIds;
  const historyTemplates = useMemo(() => {
    const applied = new Set((liveAppliedIds || []).map(String));
    return Object.keys(runsByTemplate)
      .filter(id => !applied.has(String(id)))
      .map(id => carePlanTemplates.find(t => String(t.id) === String(id))
        || { id, name: (live?.templateInstances || []).find(i => String(i.templateId) === String(id))?.templateName || 'Template' });
  }, [runsByTemplate, liveAppliedIds, carePlanTemplates, live?.templateInstances]);
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
  // The drawer is driven entirely by the store flag, the toolbar button and
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
    // A barrier row stands for every clone with its title (see renameBarrier).
    if (kind === 'barrier') {
      const key = norm(item.title);
      const clones = (data.barriers || []).filter(b => norm(b.title) === key);
      (clones.length ? clones : [item]).forEach(row => (
        savePatientCarePlanBarrier(patientId, program, { ...row, priority, goalIds: item.goalIds || row.goalIds }, row.id)
      ));
      return;
    }
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

  // The barrier table shows one row per title (legacy clones merged), so a
  // rename updates every clone with the merged goal links, the same way the
  // Barrier drawer saves, and they stay one row.
  const renameBarrier = async (barrier, title) => {
    const key = norm(barrier.title);
    const clones = (data.barriers || []).filter(b => norm(b.title) === key);
    await Promise.all((clones.length ? clones : [barrier]).map(row => (
      savePatientCarePlanBarrier(patientId, program, { ...row, title, goalIds: barrier.goalIds || row.goalIds }, row.id)
    )));
  };

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
  // the new row: restoring them in any other order returns them loose.
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
      pickTemplateSource,
      // The template selected on the plan, or the whole plan when none is.
      defaultTemplateSourceId: appliedTemplateIds.includes(templateFilterId) ? templateFilterId : 'all',
      setTemplatesDrawerOpen,
      setHistoryOpen,
      setFiltersOpen,
      openNoteDrawer,
      setSignNote,
      setSignOpen,
      scanForDuplicates,
      runIndividualizedPlan,
      setPauseOpen,
      resumePlan,
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
  // Section-header duplicate badge: opens the section's duplicates in a
  // popover. Nothing renders when the kind has no open duplicate flags.
  const renderDuplicateBadge = (kind) => {
    const flags = flagsForKind(kind);
    // An earlier run is history; duplicates are about the live plan.
    if (!flags.length || viewedRun || versionData) return null;
    const expanded = duplicatesOpen?.kind === kind;
    return (
      <button
        type="button"
        className={styles.duplicateBadgeBtn}
        onClick={(e) => setDuplicatesOpen(expanded ? null : { kind, rect: e.currentTarget.getBoundingClientRect() })}
        aria-expanded={expanded}
        aria-haspopup="dialog"
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
  // The open section's duplicates; closes once the last one is resolved.
  const renderDuplicatesPopover = () => {
    const flags = duplicatesOpen ? flagsForKind(duplicatesOpen.kind) : [];
    if (!flags.length) return null;
    const close = () => setDuplicatesOpen(null);
    return (
      <CarePlanDuplicatePopover
        anchorRect={duplicatesOpen.rect}
        kind={duplicatesOpen.kind}
        flags={flags}
        onClose={close}
        onIgnore={handleDuplicateIgnore}
        onAcceptExisting={handleDuplicateAcceptExisting}
        onAcceptNew={handleDuplicateAcceptNew}
        onEditExisting={(flag) => { close(); handleDuplicateEditExisting(flag); }}
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

  // Recommended care plan: the automation-matched templates merged by UnityAI
  // (lib/individualizedPlan); each item stays flagged with its evidence until
  // the plan is approved.
  const [aiDrafting, setAiDrafting] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiDiscardOpen, setAiDiscardOpen] = useState(false);
  const recommendCarePlan = useAppStore(s => s.recommendCarePlan);
  const reviewAiSuggestions = useAppStore(s => s.reviewAiSuggestions);
  const setCarePlanRecommendedTemplates = useAppStore(s => s.setCarePlanRecommendedTemplates);
  const aiPending = useMemo(() => (viewedVersion ? [] : pendingRecommendation(live)), [live, viewedVersion]);
  const planIsEmpty = !live || (live.goals.length + live.interventions.length + (live.barriers || []).length) === 0;
  const runIndividualizedPlan = async () => {
    if (!canEdit || viewedVersion || aiDrafting) return;
    setAiDrafting(true);
    setAiError('');
    try {
      const r = await recommendCarePlan(patientId, program);
      const n = r.recommended.length;
      showToast(n
        ? `Recommended ${r.counts} from ${n} automation-matched ${n === 1 ? 'template' : 'templates'}`
        : `No automation matched; UnityAI recommended ${r.counts}`);
    } catch (err) {
      setAiError(err.message || 'Could not draft the plan.');
      showToast(err.message || 'Could not draft the plan.');
    } finally {
      setAiDrafting(false);
    }
  };
  const aiReview = useMemo(() => (canEdit ? {
    onReview: (kind, item) => reviewAiSuggestions(patientId, program, [{ kind, item }]),
  } : null), [canEdit, reviewAiSuggestions, patientId, program]);
  const reviewAllAi = async () => {
    setAiBusy(true);
    try {
      const n = await reviewAiSuggestions(patientId, program, aiPending);
      if (n) showToast(`Approved the recommended plan (${n} ${n === 1 ? 'item' : 'items'})`);
    } finally {
      setAiBusy(false);
    }
  };
  const discardAi = async () => {
    setAiDiscardOpen(false);
    setAiBusy(true);
    try {
      await Promise.all(aiPending.map(({ kind, item }) => (
        kind === 'goal' ? deletePatientCarePlanGoal(patientId, program.id, item.id, { cascade: false })
          : kind === 'intervention' ? deletePatientCarePlanIntervention(patientId, program.id, item.id)
            : deletePatientCarePlanBarrier(patientId, program.id, item.id)
      )));
      await setCarePlanRecommendedTemplates(patientId, program, []);
      showToast('Discarded the recommended plan');
    } finally {
      setAiBusy(false);
    }
  };
  const handleApplyTemplates = async (ids, priorities, categoryPicks) => {
    setTemplatesDrawerOpen(false);
    if (!canEdit) return;
    if (episodes.interceptApply(ids, priorities, categoryPicks)) return;
    await applyPatientCarePlanTemplates(patientId, program, ids, priorities, categoryPicks);
  };
  const handleTrends = () => setTrendsOpen(true);
  const handleAssigneeChange = (intervention, user) => {
    if (!canEdit) return;
    const unassign = user.name === 'Unassigned';
    // config.assignedTo is what the intervention editor opens with, so it
    // moves with the assignee instead of reopening on the old name.
    savePatientCarePlanIntervention(patientId, program, {
      ...intervention,
      assignee: { name: user.name, initials: user.initials || '' },
      config: { ...(intervention.config || {}), assignedTo: unassign ? '' : user.name },
    }, intervention.id);
    showToast(unassign ? `"${intervention.title}" unassigned` : `Assigned to ${user.name}`);
  };

  // Switching what gets saved also switches the conditions to match it.
  function pickTemplateSource(id) {
    setTemplateSourceId(id);
    const source = id === 'all' ? null : appliedTemplates.find(t => t.id === id);
    // Saving one template's part of the plan is a copy of it, so it starts
    // named as one; a name someone typed is left alone.
    const copyName = t => `${t.name} (Copy)`;
    setTemplateName(prev => {
      const wasAuto = !prev.trim() || appliedTemplates.some(t => copyName(t) === prev);
      if (!wasAuto) return prev;
      return source ? copyName(source) : '';
    });
    setTemplateConditions(source
      ? (source.conditions || [])
      : (live?.plan?.conditions || []).map(c => c.label));
  }

  const saveTemplate = async () => {
    if (!templateName.trim()) return;
    const saved = await savePatientCarePlanAsTemplate(
      patientId, program, templateName, templateConditions,
      templateSourceId === 'all' ? null : templateSourceId,
      templateScope,
    );
    setTemplateOpen(false);
    setTemplateName('');
    setTemplateConditions([]);
    setTemplateScope('patient');
    if (saved) {
      const where = { patient: 'for this patient', user: 'for you only', org: 'to the library' }[templateScope];
      showToast(`Saved "${saved.name}" ${where}`);
    }
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
    // writes are independent: run them together. Each item is resolved by a
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
    // Past version / earlier template run: item drawers open read-only on that copy.
    itemSnapshot: versionData || viewedRun ? viewData : null,
    previewIntervention, setPreviewIntervention, intvDrawer, setIntvDrawer, handleAddIntervention,
    notesFocus, setNotesFocus,
    intvSpecialDrawer, setIntvSpecialDrawer, auditAll, saveInterventionFromConfig,
    taskDrawerOpen, setTaskDrawerOpen, taskGoalId, setTaskGoalId, patientName,
    addBarriersDrawerOpen, setAddBarriersDrawerOpen, barrierAddGoalIdRef, handleAddBarriersFromPicker,
    barrierDrawer, setBarrierDrawer, handleAddBarrier, shareOpen, clearCarePlanShareRequest, canEdit,
    historyOpen, setHistoryOpen, versionsOpen, setVersionsOpen, signOpen, setSignOpen, doSign, signNote, setSignNote,
    noteOpen, closeNoteDrawer, doAddNote, noteText, setNoteText, noteDirty, latestPlanNote, noteTimelineEntries,
    noteDiscardOpen, setNoteDiscardOpen, noteDeleteOpen, setNoteDeleteOpen, doClearCareNote,
    problemOpen, setProblemOpen, doAddProblem, problemText, setProblemText,
    trendsOpen, setTrendsOpen, measurements,
    templatesDrawerOpen, setTemplatesDrawerOpen, appliedTemplateIds, applyAgainTemplate, setApplyAgainTemplate,
    templateCreateOpen, setTemplateCreateOpen, createdTemplateIds, setCreatedTemplateIds, appliedTemplatePriorities, handleApplyTemplates,
    templateOpen, setTemplateOpen, templateName, setTemplateName, templateConditions, setTemplateConditions, saveTemplate,
    templateSourceId, pickTemplateSource, appliedTemplates, templateScope, setTemplateScope,
    deleteTarget, setDeleteTarget, live, removeGoal, confirmDelete,
    bulkAssignOpen, setBulkAssignOpen, bulkAssign, bulkDeleteOpen, setBulkDeleteOpen, bulkDelete, selectedCount,
  };

  return (
    <AiReviewContext.Provider value={aiReview}>
    <CarePlanPausedContext.Provider value={planPaused}>
    <div className={styles.container}>
      <div className={styles.stickyTop}>
        {/* pinned templates + problems bar */}
        <AppliedTemplateStrip
          templates={appliedTemplates}
          appliedTemplatePriorities={appliedTemplatePriorities}
          templateFilterId={templateFilterId}
          canRemove={canEdit && !live?.plan?.signedAt}
          onSelect={(id) => setTemplateFilterId(prev => (prev === id ? null : id))}
          onRemove={handleRemoveTemplate}
          runsByTemplate={viewedVersion ? {} : runsByTemplate}
          historyTemplates={viewedVersion ? [] : historyTemplates}
          templateVersions={viewedVersion ? {} : templateVersionInfo}
          readOnly={!!viewedVersion}
          recommended={viewedVersion ? [] : (live?.plan?.recommendedTemplates || [])}
          trailing={(
            <span className={styles.stripActions}>
              <span className={styles.stripDivider} aria-hidden="true" />
              <Button
                variant="ghost"
                size="sm"
                leadingIcon="solar:add-linear"
                onClick={handleTemplates}
                disabled={!canEdit}
              >
                Templates
              </Button>
            </span>
          )}
        />
        {/* Conditions are intentionally not surfaced in the plan header; they
            still travel with the plan and appear in the Share / Download
            preview (see CarePlanShareDrawer). */}
        {/* Pinned under the templates strip so the filters stay in reach
            while the plan scrolls. */}
        {filtersOpen && (
          <div className={styles.filterBar}>
            <FilterChip label="Status" options={ALL_GBI_STATUSES} selected={filters.status} onChange={v => setFilter('status', v)} />
            <FilterChip label="Priority" options={PRIORITY_LABELS} selected={filters.priority} onChange={v => setFilter('priority', v)} />
            {filtersActive ? (
              <button type="button" className={styles.clearAll} onClick={clearFilters}>
                <Icon name="solar:backspace-linear" size={16} color="var(--primary-300)" />
                Clear All
              </button>
            ) : null}
          </div>
        )}
      </div>

      <div className={styles.scrollArea}>
      <div className={styles.contentBody}>
      {viewedVersion && (
        <div className={styles.runBanner} role="status">
          <Icon name="solar:history-linear" size={16} color="var(--neutral-300)" />
          <span className={styles.runBannerText}>
            <strong>Version {viewedVersion.versionNumber}</strong>
            {viewedVersion.createdBy ? ` · ${viewedVersion.reason === 'restore' ? 'Restored' : viewedVersion.reason === 'signed' ? 'Signed' : 'Saved'} by ${viewedVersion.createdBy}` : ''}
            {viewedVersion.createdAt ? ` ${new Date(viewedVersion.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
            {' · Read only'}
          </span>
          <button type="button" className={styles.runBannerBack} onClick={() => setViewedCarePlanVersion(carePlanKey, null)}>
            Back to current plan
          </button>
        </div>
      )}
      {viewedRun && !viewedVersion && (
        <div className={styles.runBanner} role="status">
          <Icon name="solar:check-circle-linear" size={16} color="var(--status-success)" />
          <span className={styles.runBannerText}>
            <strong>{viewedRun.run.templateName}{viewedRun.run.categoryName ? ` · ${viewedRun.run.categoryName}` : ''} V{viewedRun.version}</strong>
            {` · ${viewedRun.run.closeReason === 'ended_early' ? 'Episode ended early'
              : viewedRun.run.closeReason === 'episode_end' ? 'Episode ended on its last day'
                : viewedRun.run.status === 'completed' ? 'Completed' : 'Closed'}`}
            {viewedRun.run.endedAt ? ` ${formatInstanceDate(viewedRun.run.endedAt)}` : ''}
            {viewedRun.run.totalCount != null ? ` · ${viewedRun.run.doneCount} of ${viewedRun.run.totalCount} goals and interventions met` : ''}
            {' · Read only'}
          </span>
          <button type="button" className={styles.runBannerBack} onClick={() => setTemplateFilterId(null)}>
            Back to current plan
          </button>
        </div>
      )}
      {planPaused && (
        <div className={styles.pausedBanner}>
          <Alert
            tone="info"
            icon="solar:pause-circle-linear"
            message={<><strong>Care plan paused</strong> · {pauseSummary(live.plan.pause)}. No cadence, overdue flags or automated outreach until it resumes.</>}
          />
          {canEdit && (
            <Button variant="outline" size="sm" leadingIcon="solar:play-circle-linear" onClick={resumePlan}>
              Resume Now
            </Button>
          )}
        </div>
      )}
      {episodes.banners}
      {!viewedVersion && !viewedRun && categoryHints.map(s => (
        <CategorySuggestionBanner
          key={s.run.id}
          suggestion={s}
          canEdit={canEdit}
          onSwitch={({ template, to, reasons }) => switchCarePlanTemplateCategory(patientId, program, template.id, to.id, reasons.join('; '))}
          onDismiss={({ run, to }) => dismissCarePlanCategorySuggestion(patientId, program, run.id, to.id)}
        />
      ))}
      {aiDrafting ? (
        <IndividualizedPlanCard state="drafting" />
      ) : aiPending.length > 0 && canEdit ? (
        <IndividualizedPlanCard
          state="review"
          pending={aiPending.length}
          templates={live?.plan?.recommendedTemplates || []}
          busy={aiBusy}
          onReviewAll={reviewAllAi}
          onDiscard={() => setAiDiscardOpen(true)}
        />
      ) : !carePlanLoading && planIsEmpty && canEdit && !viewedVersion ? (
        <IndividualizedPlanCard state="start" error={aiError} onDraft={runIndividualizedPlan} onUseTemplate={handleTemplates} />
      ) : null}
      {!carePlanLoading && (viewData.goals.length + viewData.interventions.length + (viewData.barriers || []).length) > 0 && (
        <div className={styles.summaryStrip}>
          <span className={styles.summaryMetric}><strong>{planStats.goals}</strong> goals</span>
          <span className={styles.summaryDot} aria-hidden="true" />
          <span className={styles.summaryMetric}><strong>{planStats.iv}</strong> interventions</span>
          <span className={styles.summaryDot} aria-hidden="true" />
          <span className={styles.summaryMetric}><strong>{planStats.br}</strong> barriers</span>
          <span className={styles.summaryDot} aria-hidden="true" />
          <span className={styles.summaryMetric}><strong>{planStats.avgProgress}%</strong> avg progress</span>
          {!planPaused && live?.plan?.nextTouchpoint && (
            <>
              <span className={styles.summaryDot} aria-hidden="true" />
              <span className={styles.summaryMetric}>Next touchpoint <strong>{fmtCarePlanDate(live.plan.nextTouchpoint)}</strong></span>
            </>
          )}
          {planStats.statuses.length > 0 && (
            <span className={styles.summaryStatuses}>
              {planStats.statuses.map(({ status, count, tone }) => (
                <Badge key={status} tone={tone} size="S" label={`${count} ${status}`} />
              ))}
            </span>
          )}
        </div>
      )}
      {!carePlanLoading && !planIsEmpty && !viewedVersion && !viewedRun && (
        <CarePlanAiSummarySection
          patientId={patientId}
          program={program}
          patientName={patientName}
          live={live}
          open={openSections.aiSummary}
          onToggle={() => toggleSection('aiSummary')}
        />
      )}
      {!carePlanLoading && latestPlanNote && (
        <section className={styles.careNoteSection}>
          <div className={styles.careNoteHead}>
            {/* Same title treatment as the Goals / Interventions / Barriers heads. */}
            <SectionTitle
              label="Care Note"
              open={openSections.careNote}
              onToggle={() => toggleSection('careNote')}
            />
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
                    size="sm"
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
              // Resolved is barrier-only, so it's offered when only barriers are selected.
              const barriersOnly = selected.barrier.size > 0 && !selected.goal.size && !selected.intv.size;
              setBulkMenu({ rect: el ? el.getBoundingClientRect() : null, type: 'status', barriersOnly });
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
            variant: 'soft', tone: 'danger',
            onClick: () => setBulkDeleteOpen(true),
          }]}
        />
      )}

      {layout === 'linkage' ? (
        <div className={styles.section}>
          <GbiSectionHead
            title="Goals and Linked Items"
            count={filteredGoals.length}
            open={openSections.linkage}
            onToggle={() => toggleSection('linkage')}
            addButton={(
              <ActionButton size="sm" tooltip="Add goal" onClick={() => setAddGoalsDrawerOpen(true)} disabled={!canEdit}>
                <AddIconMinimalist size={16} color="var(--neutral-300)" />
              </ActionButton>
            )}
          />
          {openSections.linkage && (
            <CarePlanLinkageSection
              goals={filteredGoals}
              interventions={filteredInterventions}
              barriers={plainBarriers}
              allGoals={viewData.goals}
              loading={carePlanLoading}
              canEdit={canEdit}
              patientId={patientId}
              program={program}
              saveIntervention={savePatientCarePlanIntervention}
              saveBarrier={savePatientCarePlanBarrier}
              showToast={showToast}
              onOpenGoal={setPreviewGoal}
              onOpenIntervention={setPreviewIntervention}
              onOpenBarrier={setPreviewBarrier}
            />
          )}
        </div>
      ) : (
      <>
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
            <ActionButton size="sm" tooltip="Add goal" onClick={() => setAddGoalsDrawerOpen(true)} disabled={!canEdit}>
              <AddIconMinimalist size={16} color="var(--neutral-300)" />
            </ActionButton>
          )}
        />
        {openSections.goals && (carePlanLoading ? (
          <SimpleTableSkeleton rows={3} cols={6} />
        ) : filteredGoals.length === 0 && viewData.goals.length === 0 ? (
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
            onOpenNotes={(g) => openNotesFor('goal', g)}
            onTitleChange={(goal, title) => savePatientCarePlanGoal(patientId, program, { ...goal, title }, goal.id)}
            hasNote={(g) => noteLookup('goal', g.id)}
            linked={linkedForGoalRow}
            emptyState={filteredGoals.length === 0 ? <div className={styles.emptyRow}>No goals match the search or filters.</div> : null}
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
          rightAccessory={(
            <>
              {renderDuplicateBadge('intervention')}
              {/* Assignee only applies to interventions, so it filters here
                  rather than in the plan-wide filter bar. */}
              {assigneeOptions.length > 0 && (
                <FilterChip
                  label="Assignee"
                  size="XS"
                  searchable
                  options={assigneeOptions}
                  selected={filters.assignee}
                  onChange={v => setFilter('assignee', v)}
                />
              )}
            </>
          )}
          addButton={(
            <ActionButton
              ref={intvAddRef}
              size="sm"
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
        {openSections.interventions && (carePlanLoading ? (
          <SimpleTableSkeleton rows={3} cols={6} />
        ) : filteredInterventions.length === 0 && viewData.interventions.length === 0 ? (
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
            onOpenNotes={(i) => openNotesFor('intervention', i)}
            onTitleChange={(intv, title) => savePatientCarePlanIntervention(patientId, program, { ...intv, title }, intv.id)}
            hasNote={(i) => noteLookup('intervention', i.id)}
            linked={linkedForChildRow}
            platformUsers={platformUsers}
            patients={patientName ? [{
              id: patientId,
              name: patientName,
              initials: (patientName || '').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase(),
            }] : []}
            emptyState={filteredInterventions.length === 0 ? <div className={styles.emptyRow}>No interventions match the search or filters.</div> : null}
          />
        ))}
      </div>

      {/* Barriers (resolved ones collapse into their own footer) */}
      <div className={styles.section}>
        <GbiSectionHead
          title="Barriers"
          count={plainBarriers.length}
          open={openSections.barriers}
          onToggle={() => toggleSection('barriers')}
          rightAccessory={renderDuplicateBadge('barrier')}
          addButton={(
            <ActionButton size="sm" tooltip="Add barrier" onClick={() => setAddBarriersDrawerOpen(true)} disabled={!canEdit}>
              <AddIconMinimalist size={16} color="var(--neutral-300)" />
            </ActionButton>
          )}
        />
        {openSections.barriers && (carePlanLoading ? (
          <SimpleTableSkeleton rows={3} cols={3} />
        ) : plainBarriers.length === 0 && (viewData.barriers || []).filter(b => !isSdohBarrier(b)).length === 0 ? (
          <SectionEmptyState
            icon="solar:signpost-2-linear"
            label="No Barriers Created for Selected Problem"
            onAdd={() => setAddBarriersDrawerOpen(true)}
          />
        ) : (
          <CarePlanBarriersTable
            rows={plainBarriers}
            canEdit={canEdit}
            bulkMode={bulkMode}
            selectedIds={[...selected.barrier]}
            onSelectAll={(checked) => selectAllKind('barrier', plainBarriers, checked)}
            onToggleSelect={(id) => toggleSelect('barrier', id)}
            onStatusMenu={setStatusMenu}
            onPriorityMenu={setPriorityMenu}
            onRowMenu={setStatusMenu}
            onOpenBarrier={setPreviewBarrier}
            onOpenNotes={(b) => openNotesFor('barrier', b)}
            onTitleChange={renameBarrier}
            hasNote={(b) => noteLookup('barrier', b.id)}
            linked={linkedForChildRow}
            emptyState={plainBarriers.length === 0 ? <div className={styles.emptyRow}>No barriers match the search or filters.</div> : null}
          />
        ))}
      </div>
      </>
      )}

      {/* Social Needs (SDOH): barriers with a domain, and their referrals */}
      <div className={styles.section}>
        <GbiSectionHead
          title="Social Needs (SDOH)"
          count={sdohBarriers.length}
          open={openSections.sdoh}
          onToggle={() => toggleSection('sdoh')}
        />
        {openSections.sdoh && (carePlanLoading ? (
          <SimpleTableSkeleton rows={3} cols={3} />
        ) : (
          <SdohSection
            mode="plan"
            barriers={sdohBarriers}
            interventions={viewData.interventions || []}
            onAddNeed={canEdit ? addSdohNeed : undefined}
            onRemoveNeed={canEdit ? (b) => setDeleteTarget({ kind: 'barrier', id: b.id, name: b.title, item: b }) : undefined}
            onStatusMenu={canEdit ? setStatusMenu : undefined}
            onRefer={canEdit ? (barrier, partner) => setReferralFor({ barrier, partner }) : undefined}
            onReferralStatus={canEdit ? setReferralStatus : undefined}
            onRemoveReferral={canEdit ? (r) => setDeleteTarget({ kind: 'intv', id: r.id, name: r.title, item: r }) : undefined}
          />
        ))}
      </div>

      {renderDuplicatesPopover()}
      </div>
      </div>

      <CarePlanViewOverlays {...overlayProps} />
      {episodes.dialogs}

      <CarePlanViewDrawers {...drawerProps} />

      {referralFor && (
        <SdohReferralDialog
          partner={referralFor.partner}
          barrier={referralFor.barrier}
          onCancel={() => setReferralFor(null)}
          onSubmit={saveReferral}
        />
      )}
      {pauseOpen && <PauseCarePlanDialog onCancel={() => setPauseOpen(false)} onSubmit={submitPause} />}
      {aiDiscardOpen && (
        <ConfirmDialog
          variant="destructive"
          title="Discard AI-drafted items?"
          description={`Removes the ${aiPending.length} AI-drafted ${aiPending.length === 1 ? 'item' : 'items'} still awaiting review. Items you've reviewed or added yourself stay.`}
          confirmLabel="Discard"
          onCancel={() => setAiDiscardOpen(false)}
          onConfirm={discardAi}
        />
      )}
    </div>
    </CarePlanPausedContext.Provider>
    </AiReviewContext.Provider>
  );
}
