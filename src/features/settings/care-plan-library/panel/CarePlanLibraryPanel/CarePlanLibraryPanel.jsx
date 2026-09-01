import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../../../../components/Icon/Icon';
import { Badge } from '../../../../../components/Badge/Badge';
import { BadgeRow } from '../../../../../components/BadgeRow/BadgeRow';
import { Button } from '../../../../../components/Button/Button';
import { Input } from '../../../../../components/Input/Input';
import { Textarea } from '../../../../../components/Textarea/Textarea';
import { Select } from '../../../../../components/Select/Select';
import { ActionButton } from '../../../../../components/ActionButton/ActionButton';
import { Checkbox } from '../../../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { SectionTitleBar } from '../../../../../components/SectionTitleBar/SectionTitleBar';
import { WorklistShell } from '../../../../../components/WorklistShell/WorklistShell';
import { Drawer } from '../../../../../components/Drawer/Drawer';
import { ConfirmDialog } from '../../../../../components/ConfirmDialog/ConfirmDialog';
import { RingEmptyState } from '../../../../../components/RingEmptyState/RingEmptyState';
import { TableSkeleton } from '../../../../../components/TableSkeleton/TableSkeleton';
import { toast } from '../../../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../../../store/useAppStore';
import { AddIconMinimalist } from '../../../../../components/Icon/AddIconMinimalist';
import { CreateGoalDrawer } from '../../goals/CreateGoalDrawer/CreateGoalDrawer';
import { formatGoalTarget, formatGoalDuration } from '../../lib/goalFormat';
import styles from './CarePlanLibraryPanel.module.css';

const CARE_PLAN_TABS = [
  { key: 'template', label: 'Plan Template' },
  { key: 'goals', label: 'Goals Library' },
  { key: 'interventions', label: 'Interventions Library' },
  { key: 'barriers', label: 'Barriers Library' },
];

const TAB_META = {
  template: { entityLabel: 'Template', emptyIcon: 'solar:clipboard-list-linear' },
  goals: { entityLabel: 'Goal', emptyIcon: 'solar:flag-linear' },
  interventions: { entityLabel: 'Intervention', emptyIcon: 'solar:clipboard-check-linear' },
  barriers: { entityLabel: 'Barrier', emptyIcon: 'custom:barrier' },
};

// The intervention kinds a template can carry — same vocabulary as the goal
// drawer's Add-Intervention menu (Figma 14109:303516).
const INTERVENTION_KINDS = [
  { value: 'send-form', label: 'Send Form' },
  { value: 'patient-education', label: 'Patient Education' },
  { value: 'patient-task', label: 'Patient Task' },
  { value: 'measure-vital', label: 'Measure Vital' },
  { value: 'internal-task', label: 'Internal Task' },
];
const kindLabel = (k) => INTERVENTION_KINDS.find(o => o.value === k)?.label || k;

function filterByTitleAndDescription(list, query) {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter(x => x.title.toLowerCase().includes(q) || x.description.toLowerCase().includes(q));
}

function formatRelative(iso) {
  if (!iso) return '—';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Matches Figma's "MM/DD/YYYY | hh:mm AM/PM" cell format for Created On /
// Last Update columns.
/* Created On / Last Update both show who above when — the person is the more
   useful of the two at a glance, so it leads. */
function StampCell({ name, children }) {
  return (
    <div className={styles.createdCell}>
      {name && <span className={styles.createdBy}>{name}</span>}
      <span className={styles.createdAt}>{children}</span>
    </div>
  );
}

// Titles across the library share one ceiling.
const TITLE_MAX = 150;

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${date} | ${time}`;
}

// Figma 14106:280383 — checkbox, Template Name, Chronic Conditions,
// Created On, Last Update, Actions. Sortable columns get a `sortKey`/
// `sortType` so WorklistShell's HeaderCell renders the sort arrows.
const TEMPLATE_COLUMNS = [
  { key: 'select', label: '', showCheckbox: true, width: 44, sticky: 'left', left: 0 },
  { key: 'name', label: 'Template Name', sortKey: 'name', sortType: 'alpha', sticky: 'left', left: 44, width: 280 },
  { key: 'conditions', label: 'Chronic Conditions', sortKey: 'conditions', sortType: 'alpha', width: 280 },
  { key: 'createdOn', label: 'Created On', sortKey: 'createdAt', sortType: 'date', width: 200 },
  { key: 'updated', label: 'Last Update', sortKey: 'updatedAt', sortType: 'date', width: 200 },
  { key: 'actions', label: 'Actions', sticky: 'right', width: 196 },
];

// Figma 14181:316571 — checkbox, Goals Title, Type, Linked Items, Target
// Value, Duration, Chronic Conditions, Created On, Actions. Widths are the
// design's min/max column bounds.
const GOAL_COLUMNS = [
  { key: 'select', label: '', showCheckbox: true, width: 44, sticky: 'left', left: 0 },
  { key: 'title', label: 'Goals Title', sortKey: 'title', sortType: 'alpha', sticky: 'left', left: 44, width: 280 },
  { key: 'type', label: 'Type', sortKey: 'type', sortType: 'alpha', width: 120 },
  { key: 'linked', label: 'Linked Items', width: 140 },
  { key: 'target', label: 'Target Value', width: 200 },
  { key: 'duration', label: 'Duration', width: 120 },
  { key: 'conditions', label: 'Chronic Conditions', sortKey: 'conditions', sortType: 'alpha', width: 250 },
  { key: 'createdOn', label: 'Created On', sortKey: 'createdAt', sortType: 'date', width: 220 },
  { key: 'actions', label: 'Actions', sticky: 'right', width: 156 },
];

// Linked Items is a single total — the per-kind breakdown isn't surfaced here.
const linkedCount = (item) => (item.interventions || []).length
  + Object.values(item.linked || {}).reduce((n, v) => n + (v || 0), 0);

const SIMPLE_COLUMNS = [
  { key: 'title', label: 'Title', sticky: 'left', left: 0, width: 260 },
  { key: 'description', label: 'Description', width: 360 },
  { key: 'linked', label: 'Linked Items', width: 140 },
  { key: 'createdOn', label: 'Created On', width: 220 },
  { key: 'updated', label: 'Last Updated', width: 130 },
  { key: 'actions', label: 'Actions', sticky: 'right', width: 100 },
];

const INTERVENTION_COLUMNS = [
  { key: 'title', label: 'Intervention Title', sticky: 'left', left: 0, width: 280 },
  { key: 'type', label: 'Type', width: 160 },
  { key: 'description', label: 'Description', width: 340 },
  { key: 'createdOn', label: 'Created On', width: 220 },
  { key: 'updated', label: 'Last Updated', width: 130 },
  { key: 'actions', label: 'Actions', sticky: 'right', width: 100 },
];

function blankSimpleDraft(kind) {
  return { kind, id: null, title: '', description: '' };
}
function simpleDraftFrom(kind, item) {
  if (kind === 'goal') return { kind, id: item.id, goal: item };
  return { kind, id: item.id, title: item.title, description: item.description };
}

// Kebab "More Action" menu on a template row — Figma only breaks Delete out
// into this overflow menu; Edit/Duplicate get their own always-visible
// ActionButtons.
function TemplateRowMenu({ onDelete }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const openMenu = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 4, left: rect.right - 160 });
    setOpen(v => !v);
  };

  return (
    <>
      <div ref={btnRef} style={{ display: 'inline-flex' }}>
        <ActionButton icon="solar:menu-dots-linear" size="S" tooltip="More Action" onClick={openMenu} />
      </div>
      {open && createPortal(
        <div className={styles.overflowScrim} onClick={() => setOpen(false)}>
          <div className={styles.overflowMenu} style={{ top: pos.top, left: pos.left }} onClick={e => e.stopPropagation()}>
            <button
              className={`${styles.overflowItem} ${styles.overflowItemDanger}`}
              onClick={() => { setOpen(false); onDelete(); }}
            >
              <Icon name="solar:trash-bin-trash-linear" size={15} color="var(--status-error)" />
              Delete
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

export function CarePlanLibraryPanel() {
  const showToast = useAppStore(s => s.showToast);
  const setCarePlanCreateOpen = useAppStore(s => s.setCarePlanCreateOpen);
  const setCarePlanTemplateScreen = useAppStore(s => s.setCarePlanTemplateScreen);

  // Tab lives in the store (mirrored to #/settings/care-plan-library/<tab>)
  // so a refresh or shared link restores the exact library.
  const activeTab = useAppStore(s => s.carePlanTab || 'template');
  const setActiveTab = useAppStore(s => s.setCarePlanTab);
  const [searchValue, setSearchValue] = useState('');
  // Search is per-tab in intent (searching goals shouldn't leave stale text
  // filtering templates when you switch back) — clear it on tab switch
  // itself rather than via an effect.
  const handleTabChange = (key) => { setActiveTab(key); setSearchValue(''); };

  // All three tabs are served from Supabase (care_plan_* tables).
  const templates = useAppStore(s => s.carePlanTemplates);
  const goals = useAppStore(s => s.carePlanGoals);
  const barriers = useAppStore(s => s.carePlanBarriers);
  const libraryLoading = useAppStore(s => s.carePlanLibraryLoading);
  const libraryDidFetch = useAppStore(s => s.carePlanLibraryDidFetch);
  const fetchCarePlanLibrary = useAppStore(s => s.fetchCarePlanLibrary);
  const saveCarePlanGoal = useAppStore(s => s.saveCarePlanGoal);
  const deleteCarePlanGoal = useAppStore(s => s.deleteCarePlanGoal);
  const saveCarePlanBarrier = useAppStore(s => s.saveCarePlanBarrier);
  const deleteCarePlanBarrier = useAppStore(s => s.deleteCarePlanBarrier);
  const saveCarePlanTemplate = useAppStore(s => s.saveCarePlanTemplate);
  const deleteCarePlanTemplate = useAppStore(s => s.deleteCarePlanTemplate);
  const interventionTemplates = useAppStore(s => s.carePlanInterventionTemplates);
  const saveCarePlanInterventionTemplate = useAppStore(s => s.saveCarePlanInterventionTemplate);
  const deleteCarePlanInterventionTemplate = useAppStore(s => s.deleteCarePlanInterventionTemplate);
  const favorites = useAppStore(s => s.carePlanFavorites);
  const fetchCarePlanFavorites = useAppStore(s => s.fetchCarePlanFavorites);
  const toggleCarePlanFavorite = useAppStore(s => s.toggleCarePlanFavorite);
  const isFavorite = (id) => favorites.includes(id);

  const carePlanFavoritesLoaded = useAppStore(s => s.carePlanFavoritesLoaded);
  useEffect(() => {
    if (!libraryDidFetch) fetchCarePlanLibrary();
    if (!carePlanFavoritesLoaded) fetchCarePlanFavorites();
  }, [libraryDidFetch, carePlanFavoritesLoaded, fetchCarePlanLibrary, fetchCarePlanFavorites]);

  // Ordering snapshot: which templates float to the top is frozen at the
  // moment the list first loads, so starring/unstarring a row updates its icon
  // without yanking the row up or down. Re-mounting the panel (return to this
  // screen / reload) re-snapshots, applying the new favourites-at-top order.
  const [favOrder, setFavOrder] = useState(null);
  useEffect(() => {
    if (carePlanFavoritesLoaded && favOrder === null) setFavOrder(new Set(favorites));
  }, [carePlanFavoritesLoaded]); // eslint-disable-line react-hooks/exhaustive-deps -- snapshot once per mount

  // A single draft/delete-target slot, discriminated by `kind` — only one
  // drawer or confirm dialog is ever open at a time regardless of tab.
  const [draft, setDraft] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // { kind, id, name }

  const [templateSort, setTemplateSort] = useState({ key: null, dir: 'asc' });
  const handleTemplateSort = (key) => {
    setTemplateSort(prev => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  };

  const filteredTemplates = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    const base = !q ? templates : templates.filter(t =>
      t.name.toLowerCase().includes(q) || t.conditions.some(c => c.toLowerCase().includes(q))
    );
    const dir = templateSort.dir === 'asc' ? 1 : -1;
    const valueOf = (t) => (
      templateSort.key === 'conditions' ? (t.conditions[0] || '') :
      templateSort.key === 'createdAt' ? t.createdAt :
      templateSort.key === 'updatedAt' ? t.updatedAt :
      t.name
    );
    // Favorites float to the top by the frozen snapshot (favOrder), not live
    // `favorites`, so toggling a star doesn't reorder until the next mount. The
    // chosen column sorts within each group.
    const orderFav = favOrder || new Set(favorites);
    return base.toSorted((a, b) => {
      const favDiff = Number(orderFav.has(b.id)) - Number(orderFav.has(a.id));
      if (favDiff) return favDiff;
      if (!templateSort.key) return 0;
      return valueOf(a).localeCompare(valueOf(b)) * dir;
    });
  }, [templates, searchValue, templateSort, favOrder, favorites]);

  const [goalSort, setGoalSort] = useState({ key: 'title', dir: 'asc' });
  const [selectedGoalIds, setSelectedGoalIds] = useState([]);
  const [goalPage, setGoalPage] = useState(1);
  const [goalPerPage, setGoalPerPage] = useState(10);

  const filteredGoals = useMemo(() => {
    const list = filterByTitleAndDescription(goals, searchValue);
    const { key, dir } = goalSort;
    if (!key) return list;
    const val = (g) => (key === 'conditions' ? (g.conditions || []).join(', ')
      : key === 'createdAt' ? new Date(g.createdAt || 0).getTime()
        : (g[key] || ''));
    return [...list].sort((a, b) => {
      const av = val(a); const bv = val(b);
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return dir === 'desc' ? -cmp : cmp;
    });
  }, [goals, searchValue, goalSort]);

  const pagedGoals = useMemo(
    () => filteredGoals.slice((goalPage - 1) * goalPerPage, goalPage * goalPerPage),
    [filteredGoals, goalPage, goalPerPage],
  );

  const handleGoalSort = (key) => setGoalSort(prev => (
    prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
  ));
  const toggleGoal = (id) => setSelectedGoalIds(prev => (
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  ));
  const filteredBarriers = useMemo(() => filterByTitleAndDescription(barriers, searchValue), [barriers, searchValue]);
  const filteredInterventions = useMemo(
    () => filterByTitleAndDescription(interventionTemplates, searchValue),
    [interventionTemplates, searchValue],
  );

  const closeDrawer = () => setDraft(null);

  const openCreate = () => {
    // Templates get the full-pane New Care Plan view; goals/barriers/
    // interventions keep the lightweight drawer.
    if (activeTab === 'template') { setCarePlanCreateOpen(true); return; }
    if (activeTab === 'goals') { setDraft(blankSimpleDraft('goal')); return; }
    if (activeTab === 'interventions') { setDraft({ kind: 'intervention', id: null, title: '', description: '', interventionKind: 'internal-task' }); return; }
    setDraft(blankSimpleDraft('barrier'));
  };

  // Both open the full-pane template screen — the name read-only, the pencil
  // in edit mode.
  const openViewTemplate = (t) => setCarePlanTemplateScreen({ mode: 'view', template: t });
  const openEditTemplate = (t) => setCarePlanTemplateScreen({ mode: 'edit', template: t });
  const openEditSimple = (kind, item) => setDraft(simpleDraftFrom(kind, item));
  const openEditIntervention = (item) => setDraft({
    kind: 'intervention', id: item.id, title: item.title,
    description: item.description, interventionKind: item.kind,
  });

  const canSave = draft && (draft.kind === 'template'
    ? draft.name.trim().length > 0
    : (draft.title || '').trim().length > 0);

  const saveDraft = async () => {
    if (!canSave) return;
    if (draft.kind === 'template') {
      const conditions = draft.conditionsText.split(',').map(c => c.trim()).filter(Boolean);
      const saved = await saveCarePlanTemplate(
        {
          name: draft.name.trim(),
          conditions,
          goals: draft.goals,
          interventions: draft.interventions,
          barriers: draft.barriers,
        },
        draft.id,
      );
      if (!saved) return;
      toast.success(`"${draft.name.trim()}" ${draft.id ? 'updated' : 'created'}`);
    } else if (draft.kind === 'intervention') {
      const saved = await saveCarePlanInterventionTemplate(
        { title: draft.title.trim(), description: draft.description.trim(), kind: draft.interventionKind },
        draft.id,
      );
      if (!saved) return;
      toast.success(`"${draft.title.trim()}" ${draft.id ? 'updated' : 'created'}`);
    } else {
      const saved = await saveCarePlanBarrier(
        { title: draft.title.trim(), description: draft.description.trim() },
        draft.id,
      );
      if (!saved) return;
      toast.success(`"${draft.title.trim()}" ${draft.id ? 'updated' : 'created'}`);
    }
    closeDrawer();
  };

  const confirmDelete = () => {
    const { kind, id, name } = deleteTarget;
    if (kind === 'template') deleteCarePlanTemplate(id);
    else if (kind === 'goal') deleteCarePlanGoal(id);
    else if (kind === 'intervention') deleteCarePlanInterventionTemplate(id);
    else deleteCarePlanBarrier(id);
    showToast(`"${name}" deleted`);
    setDeleteTarget(null);
  };

  const duplicateTemplate = async (t) => {
    const saved = await saveCarePlanTemplate({
      name: `${t.name} (Copy)`,
      conditions: t.conditions,
      goals: t.goals.map(g => ({ ...g })),
      interventions: t.interventions.map(i => ({ ...i })),
      barriers: (t.barriers || []).map(b => ({ ...b })),
    });
    if (saved) toast.success(`"${t.name}" duplicated`);
  };

  const duplicateGoal = async (g) => {
    const saved = await saveCarePlanGoal({ ...g, title: `${g.title} (Copy)` });
    if (saved) toast.success(`"${g.title}" duplicated`);
  };



  const renderTemplateRow = (t) => (
    <tr key={t.id} className={styles.row}>
      <td className={styles.tdCheck} onClick={e => e.stopPropagation()}>
        <Checkbox aria-label={`Select ${t.name}`} />
      </td>
      <td className={`${styles.tdName} ${styles.tdNameOffset}`}>
        <button type="button" className={styles.nameLink} onClick={() => openViewTemplate(t)}>{t.name}</button>
      </td>
      <td className={styles.tdConditions}>
        <div className={styles.chipRow}>
          {t.conditions.map(c => <Badge key={c} tone="grey" size="S" label={c} />)}
        </div>
      </td>
      <td className={styles.tdUpdated}><StampCell name={t.createdBy}>{formatDateTime(t.createdAt)}</StampCell></td>
      <td className={styles.tdUpdated}><StampCell name={t.updatedBy}>{formatDateTime(t.updatedAt)}</StampCell></td>
      <td className={styles.tdActions} onClick={e => e.stopPropagation()}>
        <div className={styles.actionCell}>
          <ActionButton
            size="S"
            tooltip={isFavorite(t.id) ? 'Remove favorite' : 'Add favorite'}
            onClick={() => toggleCarePlanFavorite(t.id)}
          >
            <Icon
              name={isFavorite(t.id) ? 'solar:star-bold' : 'solar:star-linear'}
              size={16}
              color={isFavorite(t.id) ? 'var(--status-warning)' : 'var(--neutral-300)'}
            />
          </ActionButton>
          <div className={styles.vDivider} />
          <ActionButton icon="solar:pen-linear" size="S" tooltip="Edit" onClick={() => openEditTemplate(t)} />
          <div className={styles.vDivider} />
          <ActionButton icon="solar:copy-linear" size="S" tooltip="Duplicate" onClick={() => duplicateTemplate(t)} />
          <div className={styles.vDivider} />
          <TemplateRowMenu onDelete={() => setDeleteTarget({ kind: 'template', id: t.id, name: t.name })} />
        </div>
      </td>
    </tr>
  );

  const renderGoalRow = (g) => (
    <tr key={g.id} className={styles.row}>
      <td className={styles.tdCheck} onClick={e => e.stopPropagation()}>
        <Checkbox
          checked={selectedGoalIds.includes(g.id)}
          onCheckedChange={() => toggleGoal(g.id)}
          aria-label={`Select ${g.title}`}
        />
      </td>
      <td className={`${styles.tdName} ${styles.tdNameOffset}`}>
        <button type="button" className={styles.nameLink} onClick={() => openEditSimple('goal', g)}>{g.title}</button>
      </td>
      <td className={styles.tdType}>
        {g.type ? <Badge tone="grey" size="S" label={g.type} /> : '—'}
      </td>
      <td className={styles.tdLinked}>
        <Badge tone="grey" size="S" label={String(linkedCount(g))} />
      </td>
      <td className={styles.tdMuted}>{formatGoalTarget(g) || '—'}</td>
      <td className={styles.tdMuted}>{formatGoalDuration(g) || '—'}</td>
      <td className={styles.tdConditions}>
        {(g.conditions || []).length
          ? <BadgeRow items={g.conditions} maxLines={2} />
          : '—'}
      </td>
      <td className={styles.tdMuted}><StampCell name={g.createdBy}>{formatDateTime(g.createdAt)}</StampCell></td>
      <td className={styles.tdActions} onClick={e => e.stopPropagation()}>
        <div className={styles.actionCell}>
          <ActionButton icon="solar:pen-linear" size="S" tooltip="Edit" onClick={() => openEditSimple('goal', g)} />
          <div className={styles.vDivider} />
          <ActionButton icon="solar:copy-linear" size="S" tooltip="Duplicate" onClick={() => duplicateGoal(g)} />
          <div className={styles.vDivider} />
          <TemplateRowMenu onDelete={() => setDeleteTarget({ kind: 'goal', id: g.id, name: g.title })} />
        </div>
      </td>
    </tr>
  );

  const renderSimpleRow = (kind) => (item) => (
    <tr key={item.id} className={styles.row}>
      <td className={styles.tdName}>
        <button type="button" className={styles.nameLink} onClick={() => openEditSimple(kind, item)}>{item.title}</button>
      </td>
      <td className={styles.tdDescription}>{item.description || '—'}</td>
      <td className={styles.tdLinked}>
        <Badge tone="grey" size="S" label={String(linkedCount(item))} />
      </td>
      <td className={styles.tdMuted}><StampCell name={item.createdBy}>{formatDateTime(item.createdAt)}</StampCell></td>
      <td className={styles.tdUpdated}><StampCell name={item.updatedBy}>{formatRelative(item.updatedAt)}</StampCell></td>
      <td className={styles.tdActions} onClick={e => e.stopPropagation()}>
        <div className={styles.actionCell}>
          <ActionButton icon="solar:pen-linear" size="S" tooltip="Edit" onClick={() => openEditSimple(kind, item)} />
          <div className={styles.vDivider} />
          <ActionButton icon="solar:trash-bin-trash-linear" size="S" tooltip="Delete" onClick={() => setDeleteTarget({ kind, id: item.id, name: item.title })} />
        </div>
      </td>
    </tr>
  );

  const renderInterventionRow = (item) => (
    <tr key={item.id} className={styles.row}>
      <td className={styles.tdName}>
        <button type="button" className={styles.nameLink} onClick={() => openEditIntervention(item)}>{item.title}</button>
      </td>
      <td className={styles.tdType}>
        <Badge tone="grey" size="S" label={kindLabel(item.kind)} />
      </td>
      <td className={styles.tdDescription}>{item.description || '—'}</td>
      <td className={styles.tdMuted}><StampCell name={item.createdBy}>{formatDateTime(item.createdAt)}</StampCell></td>
      <td className={styles.tdUpdated}><StampCell name={item.updatedBy}>{formatRelative(item.updatedAt)}</StampCell></td>
      <td className={styles.tdActions} onClick={e => e.stopPropagation()}>
        <div className={styles.actionCell}>
          <ActionButton icon="solar:pen-linear" size="S" tooltip="Edit" onClick={() => openEditIntervention(item)} />
          <div className={styles.vDivider} />
          <ActionButton icon="solar:trash-bin-trash-linear" size="S" tooltip="Delete" onClick={() => setDeleteTarget({ kind: 'intervention', id: item.id, name: item.title })} />
        </div>
      </td>
    </tr>
  );

  // An empty library renders the ring state alone — no header row, no table —
  // mirroring the Insurance Plans tab. A search that matches nothing keeps the
  // table, since the columns are still meaningful there.
  const emptyPane = (label) => (
    <div className={styles.emptyPane}>
      <RingEmptyState icon={meta.emptyIcon} label={label} />
      <Button variant="primary" size="L" leadingIconElement={<AddIconMinimalist size={16} />} onClick={openCreate}>
        {`New ${meta.entityLabel}`}
      </Button>
    </div>
  );

  const meta = TAB_META[activeTab];
  const primaryActionLabel = `New ${meta.entityLabel}`;

  return (
    <div className={styles.wrapper}>
      <SectionTitleBar
        tabs={CARE_PLAN_TABS}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        actions={['search']}
        searchPlaceholder={`Search ${meta.entityLabel.toLowerCase()}s…`}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        primaryActionLabel={primaryActionLabel}
        onPrimaryAction={openCreate}
      />

      <div className={styles.content}>
        {libraryLoading && !libraryDidFetch && <TableSkeleton rows={6} />}

        {!(libraryLoading && !libraryDidFetch) && activeTab === 'template' && (
          templates.length === 0 ? emptyPane('No Care Plan Templates Added') : (
          <WorklistShell
            header={null}
            columns={TEMPLATE_COLUMNS}
            rows={filteredTemplates}
            renderRow={renderTemplateRow}
            sortKey={templateSort.key}
            sortDir={templateSort.dir}
            onSort={handleTemplateSort}
            emptyState={
              <div className={styles.emptyState}>
                <Icon name={meta.emptyIcon} size={32} color="var(--neutral-150)" />
                <p>No templates match "<strong>{searchValue.trim()}</strong>".</p>
              </div>
            }
            minTableWidth={1100}
          />
          )
        )}
        {!(libraryLoading && !libraryDidFetch) && activeTab === 'goals' && (
          goals.length === 0 ? emptyPane('No Goals Added') : (
          <WorklistShell
            header={null}
            columns={GOAL_COLUMNS}
            rows={pagedGoals}
            renderRow={renderGoalRow}
            sortKey={goalSort.key}
            sortDir={goalSort.dir}
            onSort={handleGoalSort}
            selectedIds={selectedGoalIds}
            onSelectAll={() => setSelectedGoalIds(
              selectedGoalIds.length === pagedGoals.length ? [] : pagedGoals.map(g => g.id),
            )}
            onClearSelection={() => setSelectedGoalIds([])}
            page={goalPage}
            perPage={goalPerPage}
            totalItems={filteredGoals.length}
            onPageChange={setGoalPage}
            onPageSizeChange={(n) => { setGoalPerPage(n); setGoalPage(1); }}
            emptyState={
              <div className={styles.emptyState}>
                <Icon name={meta.emptyIcon} size={32} color="var(--neutral-150)" />
                <p>No goals match "<strong>{searchValue.trim()}</strong>".</p>
              </div>
            }
            minTableWidth={1530}
          />
          )
        )}
        {!(libraryLoading && !libraryDidFetch) && activeTab === 'interventions' && (
          interventionTemplates.length === 0 ? emptyPane('No Interventions Added') : (
          <WorklistShell
            header={null}
            columns={INTERVENTION_COLUMNS}
            rows={filteredInterventions}
            renderRow={renderInterventionRow}
            emptyState={
              <div className={styles.emptyState}>
                <Icon name={meta.emptyIcon} size={32} color="var(--neutral-150)" />
                <p>No interventions match "<strong>{searchValue.trim()}</strong>".</p>
              </div>
            }
            minTableWidth={1130}
          />
          )
        )}
        {!(libraryLoading && !libraryDidFetch) && activeTab === 'barriers' && (
          barriers.length === 0 ? emptyPane('No Barriers Added') : (
          <WorklistShell
            header={null}
            columns={SIMPLE_COLUMNS}
            rows={filteredBarriers}
            renderRow={renderSimpleRow('barrier')}
            emptyState={
              <div className={styles.emptyState}>
                <Icon name={meta.emptyIcon} size={32} color="var(--neutral-150)" />
                <p>No barriers match "<strong>{searchValue.trim()}</strong>".</p>
              </div>
            }
            minTableWidth={1210}
          />
          )
        )}
      </div>

      {draft && draft.kind === 'goal' && (
        <CreateGoalDrawer
          goal={draft.goal}
          onClose={closeDrawer}
          onSave={async (values) => {
            const saved = await saveCarePlanGoal(values, draft.id);
            if (!saved) return;
            toast.success(`Goal ${draft.id ? 'updated' : 'created'} successfully`);
            closeDrawer();
          }}
        />
      )}

      {draft && draft.kind === 'barrier' && (
        <Drawer
          title={draft.id ? `Edit ${draft.kind === 'goal' ? 'Goal' : 'Barrier'}` : `New ${draft.kind === 'goal' ? 'Goal' : 'Barrier'}`}
          onClose={closeDrawer}
          secondaryAction={<Button variant="secondary" size="L" onClick={closeDrawer}>Cancel</Button>}
          primaryAction={<Button variant="primary" size="L" onClick={saveDraft} disabled={!canSave}>Save</Button>}
        >
          <div className={styles.formField}>
            <span className={styles.formLabel}>Title <span className={styles.required}>•</span></span>
            <Input
              value={draft.title}
              onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
              placeholder={draft.kind === 'goal' ? 'e.g. A1C below 7%' : 'e.g. Transportation'}
              maxLength={TITLE_MAX}
              characterLimit={TITLE_MAX}
            />
          </div>
          <div className={styles.formField}>
            <span className={styles.formLabel}>Description</span>
            <Textarea
              value={draft.description}
              onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
              placeholder="Short description"
            />
          </div>
        </Drawer>
      )}

      {draft && draft.kind === 'intervention' && (
        <Drawer
          title={draft.id ? 'Edit Intervention' : 'New Intervention'}
          onClose={closeDrawer}
          secondaryAction={<Button variant="secondary" size="L" onClick={closeDrawer}>Cancel</Button>}
          primaryAction={<Button variant="primary" size="L" onClick={saveDraft} disabled={!canSave}>Save</Button>}
        >
          <div className={styles.formField}>
            <span className={styles.formLabel}>Type</span>
            <Select
              options={INTERVENTION_KINDS}
              value={draft.interventionKind}
              onChange={(v) => setDraft(d => ({ ...d, interventionKind: v }))}
            />
          </div>
          <div className={styles.formField}>
            <span className={styles.formLabel}>Title <span className={styles.required}>•</span></span>
            <Input
              value={draft.title}
              onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
              placeholder="e.g. Measure blood pressure daily"
              maxLength={TITLE_MAX}
              characterLimit={TITLE_MAX}
            />
          </div>
          <div className={styles.formField}>
            <span className={styles.formLabel}>Description</span>
            <Textarea
              value={draft.description}
              onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
              placeholder="Short description"
            />
          </div>
        </Drawer>
      )}

      {deleteTarget && (
        <ConfirmDialog
          icon="solar:danger-triangle-linear"
          iconColor="var(--status-error)"
          title={`Delete "${deleteTarget.name}"?`}
          description={`This will remove the ${deleteTarget.kind} from the library. This action cannot be undone.`}
          confirmLabel="Delete"
          variant="error"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
