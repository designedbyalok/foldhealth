import { useEffect, useMemo, useRef, useState } from 'react';
import { Drawer } from '../../../../../components/Drawer/Drawer';
import { Button } from '../../../../../components/Button/Button';
import { Toggle } from '../../../../../components/Toggle/Toggle';
import { Input } from '../../../../../components/Input/Input';
import { Checkbox } from '../../../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { Badge } from '../../../../../components/Badge/Badge';
import { Link } from '../../../../../components/Link/Link';
import { Icon } from '../../../../../components/Icon/Icon';
import { LinkIcon } from '../../../../../components/Icon/LinkIcon';
import { PriorityIcon } from '../../../../../components/PriorityIcon/PriorityIcon';
import { AddIconMinimalist } from '../../../../../components/Icon/AddIconMinimalist';
import { CreateGoalDrawer } from '../CreateGoalDrawer/CreateGoalDrawer';
import { toast } from '../../../../../components/Toast/sonnerToast';
import { GOAL_CATEGORIES, normalizeCategory } from '../../lib/goalCategories';
import { recommendedGoalIds } from '../../lib/conditionRecommendations';
import { useAppStore } from '../../../../../store/useAppStore';
import { formatGoalTarget, formatGoalDuration } from '../../lib/goalFormat';
import styles from './AddGoalsDrawer.module.css';

// Rows shown under "Recently Used" — the newest goals in the library. There
// is no per-user usage log, so recency stands in for it. Used only in the
// settings library context (no patient); the patient care-plan context groups
// by "Added goals" / "Recommended" instead.
const RECENT_COUNT = 5;

const normTitle = (v) => (v || '').trim().toLowerCase();

// A library goal's second line: what it measures, then how long for.
function goalDetail(g) {
  const target = formatGoalTarget(g);
  return [[g.measure, target].filter(Boolean).join(' '), formatGoalDuration(g)]
    .filter(Boolean)
    .join(' • ');
}

// Total items pointing at this goal — mirrors CarePlanLibraryPanel's rollup
// so the number in the hover action badge matches the library table.
function linkedCount(g) {
  const linked = Object.values(g?.linked || {}).reduce((n, v) => n + (v || 0), 0);
  return (g?.interventions || []).length + linked;
}

/**
 * Add Goals — goal picker for the New Care Plan screen.
 * Figma Care-Plan-Creation 14109:296954.
 */
export function AddGoalsDrawer({
  onClose,
  onAdd,
  primaryLabel = 'Add',
  // Patient care-plan context. When either is provided the list groups by
  // "Added goals" (already on this plan, by title) then "Recommended" (matched
  // to the patient's Problems) then the rest, instead of "Recently Used".
  existingGoalTitles = [],
  patientProblems = [],
}) {
  const libraryGoals = useAppStore(s => s.carePlanGoals);
  const libraryDidFetch = useAppStore(s => s.carePlanLibraryDidFetch);
  const fetchCarePlanLibrary = useAppStore(s => s.fetchCarePlanLibrary);
  const saveCarePlanGoal = useAppStore(s => s.saveCarePlanGoal);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (!libraryDidFetch) fetchCarePlanLibrary();
  }, [libraryDidFetch, fetchCarePlanLibrary]);

  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(() => new Set());

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // Newest first, so "Recently Used" is the head of the list.
  const goals = useMemo(() => {
    const byNewest = [...libraryGoals].sort(
      (a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
    );
    return byNewest.map((g, i) => ({
      ...g,
      detail: goalDetail(g),
      recent: i < RECENT_COUNT,
    }));
  }, [libraryGoals]);

  // Tabs are the canonical enum, not whatever labels the rows happen to
  // carry — seeded goals still hold the pre-rename categories.
  const categories = useMemo(() => ['All', ...GOAL_CATEGORIES], []);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return goals.filter(g => {
      if (category !== 'All' && normalizeCategory(g.category) !== category) return false;
      if (!q) return true;
      return g.title.toLowerCase().includes(q) || (g.detail || '').toLowerCase().includes(q);
    });
  }, [goals, category, query]);

  const hasPatientContext = existingGoalTitles.length > 0 || patientProblems.length > 0;
  const addedTitleSet = useMemo(() => new Set(existingGoalTitles.map(normTitle)), [existingGoalTitles]);
  // Library goal ids that are already on the plan (matched by title). These
  // start checked; unchecking one on Apply removes that goal from the plan.
  const addedGoalIds = useMemo(
    () => new Set(libraryGoals.filter(g => addedTitleSet.has(normTitle(g.title))).map(g => g.id)),
    [libraryGoals, addedTitleSet],
  );
  // Seed the checked set with the already-added goals once the library loads.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || !hasPatientContext || !libraryGoals.length) return;
    setSelected(new Set(addedGoalIds));
    seededRef.current = true;
  }, [hasPatientContext, libraryGoals.length, addedGoalIds]);

  const recommendedSet = useMemo(
    () => (patientProblems.length ? recommendedGoalIds(patientProblems, libraryGoals) : new Set()),
    [patientProblems, libraryGoals],
  );

  // Grouping only reads while the list is unfiltered; a search/category filter
  // shows a flat list. Patient context groups Added → Recommended → All Goals;
  // the settings library keeps its "Recently Used" head.
  const unfiltered = category === 'All' && !query.trim();
  const grouped = hasPatientContext && unfiltered;
  const showRecentLabel = !hasPatientContext && unfiltered;
  const lastRecentId = showRecentLabel ? [...rows].reverse().find(g => g.recent)?.id : null;

  const addedRows = useMemo(
    () => (grouped ? rows.filter(g => addedTitleSet.has(normTitle(g.title))) : []),
    [grouped, rows, addedTitleSet],
  );
  const recRows = useMemo(
    () => (grouped ? rows.filter(g => !addedTitleSet.has(normTitle(g.title)) && recommendedSet.has(g.id)) : []),
    [grouped, rows, addedTitleSet, recommendedSet],
  );
  const restRows = useMemo(
    () => (grouped ? rows.filter(g => !addedTitleSet.has(normTitle(g.title)) && !recommendedSet.has(g.id)) : rows),
    [grouped, rows, addedTitleSet, recommendedSet],
  );

  // One goal row. `added` (already on the plan) starts checked and shows an
  // "Added" badge; unchecking it marks the goal for removal on Apply.
  // `divider` draws the Recently-Used hairline after the row.
  const renderRow = (g, { added = false, divider = false } = {}) => (
    <div key={g.id} className={styles.rowWrap}>
      <label className={styles.row}>
        <Checkbox
          checked={selected.has(g.id)}
          onCheckedChange={() => toggle(g.id)}
          aria-label={`Select ${g.title}`}
        />
        <span className={styles.rowText}>
          <span className={styles.rowTitle}>{g.title}</span>
          {g.detail && <span className={styles.rowDetail}>{g.detail}</span>}
        </span>
        <span className={styles.rowActions} onClick={e => e.preventDefault()}>
          <button type="button" className={styles.rowAction} aria-label="Linked items" onClick={e => e.preventDefault()}>
            <LinkIcon size={16} color="var(--neutral-300)" />
            <span className={styles.linkCount}>{linkedCount(g)}</span>
          </button>
          <button type="button" className={styles.rowAction} aria-label="Edit goal" onClick={e => e.preventDefault()}>
            <Icon name="solar:pen-linear" size={16} color="var(--neutral-300)" />
          </button>
          <button type="button" className={styles.rowAction} aria-label="Goal details" onClick={e => e.preventDefault()}>
            <Icon name="solar:info-circle-linear" size={16} color="var(--neutral-300)" />
          </button>
        </span>
        <span className={styles.rowActionsDivider} aria-hidden />
        <span className={styles.rowMeta}>
          {added && <Badge tone="grey" size="S" label="Added" />}
          {g.category && <Badge tone="grey" size="S" label={normalizeCategory(g.category)} />}
          <PriorityIcon priority={g.priority} size={16} />
        </span>
      </label>
      {divider && <span className={styles.groupDivider} />}
    </div>
  );

  // Reconcile: newly-checked goals are added; already-added goals that were
  // unchecked are removed. onAdd receives both (settings callers, which pass
  // no patient context, get only adds and ignore the second arg).
  const toAdd = goals.filter(g => selected.has(g.id) && !addedGoalIds.has(g.id));
  const toRemove = goals.filter(g => addedGoalIds.has(g.id) && !selected.has(g.id));

  const headerRight = (
    <>
      <Button
        variant="primary"
        size="L"
        disabled={toAdd.length === 0 && toRemove.length === 0}
        onClick={() => onAdd?.(toAdd, toRemove)}
      >
        {primaryLabel}
      </Button>
      <span className={styles.headerDivider} />
    </>
  );

  return (
    <Drawer title="Add Goals" onClose={onClose} headerRight={headerRight} noCloseDivider>
      <div className={styles.body}>
        <div className={styles.filterRow}>
          <Toggle size="S" items={categories} active={category} onChange={setCategory} />
          <Link className={styles.createLink} onClick={() => setCreateOpen(true)}>
            <AddIconMinimalist size={14} color="currentColor" />
            Create New Goal
          </Link>
        </div>

        <Input
          type="search"
          aria-label="Search Goal"
          placeholder="Search Goal"
          leadingIcon="solar:magnifer-linear"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />

        <div className={styles.list}>
          {rows.length === 0 ? (
            <p className={styles.empty}>
              {goals.length === 0
                ? 'No goals in the library yet.'
                : `No goals match “${query.trim()}”.`}
            </p>
          ) : grouped ? (
            <>
              {addedRows.length > 0 && (
                <>
                  <span className={styles.groupLabel}>Added goals</span>
                  {addedRows.map(g => renderRow(g, { added: true }))}
                  <span className={styles.groupDivider} />
                </>
              )}
              {recRows.length > 0 && (
                <>
                  <span className={styles.groupLabel}>Recommended</span>
                  {recRows.map(g => renderRow(g))}
                  <span className={styles.groupDivider} />
                </>
              )}
              {restRows.length > 0 && (
                <>
                  <span className={styles.groupLabel}>All Goals</span>
                  {restRows.map(g => renderRow(g))}
                </>
              )}
            </>
          ) : (
            <>
              {showRecentLabel && <span className={styles.groupLabel}>Recently Used</span>}
              {rows.map(g => renderRow(g, { divider: g.id === lastRecentId }))}
            </>
          )}
        </div>
      </div>
      {createOpen && (
        <CreateGoalDrawer
          onClose={() => setCreateOpen(false)}
          onSave={async (values) => {
            const saved = await saveCarePlanGoal(values);
            if (!saved) return;
            toast.success('Goal created successfully');
            // Creating a goal from inside the picker means you want it.
            setSelected(prev => new Set(prev).add(saved.id));
            setCreateOpen(false);
          }}
        />
      )}
    </Drawer>
  );
}
