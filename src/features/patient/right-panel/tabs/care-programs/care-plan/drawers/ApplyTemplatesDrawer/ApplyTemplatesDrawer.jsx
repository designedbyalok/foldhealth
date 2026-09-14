import { useEffect, useMemo, useState } from 'react';
import { Drawer } from '../../../../../../../../components/Drawer/Drawer';
import { Button } from '../../../../../../../../components/Button/Button';
import { Input } from '../../../../../../../../components/Input/Input';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { Link } from '../../../../../../../../components/Link/Link';
import { FilterChip } from '../../../../../../../../components/FilterChip/FilterChip';
import { Checkbox } from '../../../../../../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { PriorityIcon } from '../../../../../../../../components/PriorityIcon/PriorityIcon';
import { ActionButton } from '../../../../../../../../components/ActionButton/ActionButton';
import { useAppStore } from '../../../../../../../../store/useAppStore';
import { recommendedTemplateMatches } from '../../../../../../../settings/care-plan-library/lib';
import { TemplatePreviewDrawer } from '../TemplatePreviewDrawer';
import styles from './ApplyTemplatesDrawer.module.css';

// Figma 2349:336796 — the picker lists PROBLEMS with the parent template as
// the subtitle line and a three-button priority selector on the right.
// `onApply` carries both the selected ids and the priority map through
// `applyPatientCarePlanTemplates` to `patient_care_plans.applied_template_priorities`,
// which is what groups the badges into High / Medium / Low rows on the plan.
// Displayed High → Medium → Low (most urgent first). `medium` is the plan's
// effective default when a template is applied without an explicit pick, so a
// selected template reads Medium here to match what the care plan shows.
const PRIORITIES = ['high', 'medium', 'low'];
const DEFAULT_PRIORITY = 'medium';
// Stable empty snapshot so the favorites-grouping memo deps don't churn before
// the frozen set exists.
const EMPTY_SET = new Set();

// The condition(s) a template addresses, as a single display string. A
// template with no explicit condition reads as an em-dash placeholder.
const conditionTextOf = (t) => {
  const items = (Array.isArray(t.conditions) ? t.conditions : []).filter(Boolean);
  return items.length ? items.join(', ') : '';
};
// Sort/compare key — the first (primary) condition, lowercased. Templates with
// no condition sort last regardless of direction.
const conditionSortKey = (t) => {
  const first = (Array.isArray(t.conditions) ? t.conditions : []).filter(Boolean)[0];
  return (first || '').toLowerCase();
};

/**
 * Pick Care Plan Library templates to add to a patient plan.
 *
 * Row = a template, with its clinical Condition in a dedicated, sortable
 * column and a Low / Medium / High priority picker built from the shared
 * PriorityIcon component so priority reads the same wherever it appears in
 * the app. Templates already applied to the plan are grouped at the top so
 * re-opening the drawer surfaces what is already selected first, mirroring
 * the Barriers drawer.
 */
/**
 * @param {boolean} [props.showPriority=true]  Priority is a property of a
 *   template applied to a plan; a template being authored has nowhere to
 *   keep it, so that column and its header row come off.
 * @param {boolean} [props.showCreateNew=true]
 * @param {Array} [props.patientProblems=[]]  The patient's problem list; drives
 *   the "Recommended" group (templates whose conditions match an active problem).
 */
export function ApplyTemplatesDrawer({
  onClose,
  appliedTemplateIds = [],
  appliedTemplatePriorities = {},
  patientProblems = [],
  onApply,
  showPriority = true,
  showCreateNew = true,
}) {
  const templates = useAppStore(s => s.carePlanTemplates);
  const libraryDidFetch = useAppStore(s => s.carePlanLibraryDidFetch);
  const libraryLoading = useAppStore(s => s.carePlanLibraryLoading);
  const fetchCarePlanLibrary = useAppStore(s => s.fetchCarePlanLibrary);
  const favorites = useAppStore(s => s.carePlanFavorites);
  const carePlanFavoritesLoaded = useAppStore(s => s.carePlanFavoritesLoaded);
  const fetchCarePlanFavorites = useAppStore(s => s.fetchCarePlanFavorites);
  const toggleCarePlanFavorite = useAppStore(s => s.toggleCarePlanFavorite);

  useEffect(() => {
    if (!libraryDidFetch) fetchCarePlanLibrary();
    if (!carePlanFavoritesLoaded) fetchCarePlanFavorites();
  }, [libraryDidFetch, carePlanFavoritesLoaded, fetchCarePlanLibrary, fetchCarePlanFavorites]);

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(() => new Set(appliedTemplateIds));
  // Seed from the plan's persisted priorities so re-opening the drawer shows
  // what the user picked last time. Applied templates without an explicit pick
  // fall back to Medium (the priority the plan itself uses by default) so the
  // drawer never shows "no priority" for a template the plan ranks as Medium.
  const [priorities, setPriorities] = useState(() => {
    const seed = { ...appliedTemplatePriorities };
    appliedTemplateIds.forEach(id => { if (!seed[id]) seed[id] = DEFAULT_PRIORITY; });
    return seed;
  });
  // Condition filter chip — an OR set of conditions to keep. Empty = all.
  const [conditionFilter, setConditionFilter] = useState([]);
  // The filter row is revealed by the toolbar Filter button rather than always
  // occupying space next to search. It opens automatically if a condition
  // filter is already active (re-opening the drawer with a filter set).
  const [filtersOpen, setFiltersOpen] = useState(conditionFilter.length > 0);
  // Condition sort direction. null = library order (the default), then the
  // header cycles asc → desc → null.
  const [sortDir, setSortDir] = useState(null);
  // Template opened for read-only preview (its GBI stack), or null.
  const [previewTemplate, setPreviewTemplate] = useState(null);

  // Grouping key — the templates already applied to the plan. Kept off the
  // live `selected` set so toggling a row in-session doesn't make it jump
  // groups; it stays where it was when the drawer opened, exactly like the
  // Barriers drawer's "Already Added" group.
  const appliedSet = useMemo(() => new Set(appliedTemplateIds), [appliedTemplateIds]);

  // Favorites grouping is a frozen snapshot taken the first render the favorites
  // are loaded, not the live `favorites`, so starring a row in-session does NOT
  // make it jump to the Favorites group — it re-buckets only on the next open,
  // exactly like "Selected". The live `favorites` still drives each row's star
  // icon. Captured with the "adjust state during render" pattern (React docs)
  // so it's frozen on the same render the list first paints, once and only once.
  const [favSnapshotState, setFavSnapshotState] = useState(null);
  if (favSnapshotState === null && carePlanFavoritesLoaded) {
    setFavSnapshotState(new Set(favorites));
  }
  const favSnapshot = favSnapshotState || EMPTY_SET;

  // Every distinct condition across the library, for the filter chip.
  const conditionOptions = useMemo(() => {
    const set = new Set();
    templates.forEach(t => (Array.isArray(t.conditions) ? t.conditions : [])
      .filter(Boolean).forEach(c => set.add(c)));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [templates]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const condSet = conditionFilter.length ? new Set(conditionFilter) : null;
    let list = templates.filter(t => {
      if (condSet && !(t.conditions || []).some(c => condSet.has(c))) return false;
      if (!q) return true;
      const inName = (t.name || '').toLowerCase().includes(q);
      const inCond = (t.conditions || []).some(c => (c || '').toLowerCase().includes(q));
      return inName || inCond;
    });
    if (sortDir) {
      const dir = sortDir === 'asc' ? 1 : -1;
      list = [...list].sort((a, b) => {
        const ka = conditionSortKey(a);
        const kb = conditionSortKey(b);
        // Unconditioned templates always fall to the bottom.
        if (!ka && !kb) return 0;
        if (!ka) return 1;
        if (!kb) return -1;
        return ka.localeCompare(kb) * dir;
      });
    }
    return list;
  }, [templates, query, conditionFilter, sortDir]);

  // Live star state — flips a row's star icon the instant it is toggled. The
  // GROUPING uses the frozen `favSnapshot` instead, so a freshly starred row
  // keeps its place until the drawer is re-opened.
  const isFavorite = (id) => favorites.includes(id);

  // Templates recommended for this patient, mapped to WHY: the active problems
  // (by title) whose condition a template's conditions / name match. Empty when
  // there are no matching problems.
  const recommendedMatches = useMemo(
    () => recommendedTemplateMatches(patientProblems, templates),
    [patientProblems, templates],
  );
  const recommendedSet = useMemo(() => new Set(recommendedMatches.keys()), [recommendedMatches]);
  const reasonFor = (id) => recommendedMatches.get(id) || null;

  // Buckets, in display order: Recommended (matches the patient's conditions) →
  // Favorites (frozen star snapshot) → Selected (already on the plan) →
  // everything else. A template lands in the first bucket it qualifies for, so
  // the order above is also the precedence. Order within each bucket is
  // inherited from `rows` (search / sort applied).
  const recRows = useMemo(
    () => rows.filter(t => recommendedSet.has(t.id)),
    [rows, recommendedSet],
  );
  const favRows = useMemo(
    () => rows.filter(t => !recommendedSet.has(t.id) && favSnapshot.has(t.id)),
    [rows, recommendedSet, favSnapshot],
  );
  const addedRows = useMemo(
    () => rows.filter(t => !recommendedSet.has(t.id) && !favSnapshot.has(t.id) && appliedSet.has(t.id)),
    [rows, recommendedSet, favSnapshot, appliedSet],
  );
  const restRows = useMemo(
    () => rows.filter(t => !recommendedSet.has(t.id) && !favSnapshot.has(t.id) && !appliedSet.has(t.id)),
    [rows, recommendedSet, favSnapshot, appliedSet],
  );
  // When nothing is recommended, starred, or applied there is only one flat
  // list — drop the group labels so the drawer reads as a simple table.
  const flat = recRows.length === 0 && favRows.length === 0 && addedRows.length === 0;

  const toggle = (id) => {
    const nowSelected = !selected.has(id);
    setSelected(prev => {
      const next = new Set(prev);
      if (nowSelected) next.add(id);
      else next.delete(id);
      return next;
    });
    // Checking a template gives it the Medium default (what the plan applies)
    // so the row's priority matches the plan; unchecking drops the pick.
    setPriorities(prev => {
      if (nowSelected) return prev[id] ? prev : { ...prev, [id]: DEFAULT_PRIORITY };
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const setPriority = (id, p) => setPriorities(prev => ({
    ...prev,
    [id]: prev[id] === p ? null : p,
  }));

  const cycleSort = () => setSortDir(prev => (prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc'));

  const templateNameOf = (t) => t.name;

  const headerRight = (
    <>
      {showCreateNew && (
        <>
          <Link
            onClick={() => { /* future: open Create New template flow */ }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}
          >
            <Icon name="solar:add-linear" size={14} color="var(--primary-300)" />
            Create New
          </Link>
          <span className={styles.headerDivider} aria-hidden />
        </>
      )}
      <Button
        variant="primary"
        size="M"
        disabled={selected.size === 0}
        onClick={() => onApply?.([...selected], priorities)}
      >
        Add
      </Button>
      <span className={styles.headerDivider} aria-hidden />
    </>
  );

  const renderRow = (t, { showReason = false } = {}) => {
    const isChecked = selected.has(t.id);
    const activePriority = priorities[t.id] || null;
    const condition = conditionTextOf(t);
    // In the Recommended group, spell out which of the patient's problems put
    // this template here, so the basis for the recommendation is explicit.
    const reasons = showReason ? reasonFor(t.id) : null;
    const reasonText = reasons?.length ? `Recommended for ${reasons.join(', ')}` : null;
    return (
      <div key={t.id} className={styles.row}>
        <Checkbox
          checked={isChecked}
          onCheckedChange={() => toggle(t.id)}
          aria-label={`Select ${templateNameOf(t)}`}
        />
        <span className={styles.rowText}>
          <span className={styles.rowTitle}>{templateNameOf(t)}</span>
          {reasonText && <span className={styles.rowReason} title={reasonText}>{reasonText}</span>}
        </span>
        <span className={styles.conditionCell} title={condition || undefined}>
          {condition || <span className={styles.conditionEmpty}>—</span>}
        </span>
        {showPriority && (
          <div
            className={styles.priorityGroup}
            role="radiogroup"
            aria-label={`Priority for ${templateNameOf(t)}`}
          >
            {PRIORITIES.map(p => {
              const isActive = activePriority === p;
              return (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  aria-label={`${p} priority`}
                  data-priority={p}
                  className={`${styles.priorityBtn} ${isActive ? styles.priorityBtnActive : ''}`}
                  onClick={() => setPriority(t.id, p)}
                >
                  <PriorityIcon priority={p} size={14} />
                </button>
              );
            })}
          </div>
        )}
        <span className={styles.rowActions}>
          <ActionButton
            size="S"
            active={isFavorite(t.id)}
            tooltip={isFavorite(t.id) ? 'Remove favorite' : 'Add favorite'}
            onClick={() => toggleCarePlanFavorite(t.id)}
          >
            <Icon
              name={isFavorite(t.id) ? 'solar:star-bold' : 'solar:star-linear'}
              size={16}
              color={isFavorite(t.id) ? 'var(--status-warning)' : 'var(--neutral-300)'}
            />
          </ActionButton>
          <ActionButton
            icon="solar:eye-linear"
            size="S"
            tooltip="Preview template"
            onClick={() => setPreviewTemplate(t)}
          />
        </span>
      </div>
    );
  };

  return (
    <Drawer title="Add Care Plan Templates" onClose={onClose} headerRight={headerRight} noCloseDivider>
      <div className={styles.body}>
        <div className={styles.controls}>
          <Input
            type="search"
            aria-label="Search templates or problems"
            placeholder="Search Templates or Problems"
            leadingIcon="solar:magnifer-linear"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <ActionButton
            icon="custom:filter"
            size="L"
            tooltip="Filter"
            active={filtersOpen || conditionFilter.length > 0}
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen(v => !v)}
          />
        </div>

        {filtersOpen && (
          <div className={styles.filterBar}>
            <FilterChip
              label="Condition"
              options={conditionOptions}
              selected={conditionFilter}
              onChange={setConditionFilter}
              searchable
            />
          </div>
        )}

        <div className={styles.list}>
          <div className={styles.tableHead} role="row">
            <span className={styles.tableHeadName}>Template</span>
            <button
              type="button"
              className={styles.tableHeadCondition}
              onClick={cycleSort}
              aria-label="Sort by condition"
              aria-sort={sortDir === 'asc' ? 'ascending' : sortDir === 'desc' ? 'descending' : 'none'}
            >
              Condition
              <SortGlyph dir={sortDir} />
            </button>
            {showPriority && <span className={styles.tableHeadPriority}>Priority</span>}
            <span className={styles.tableHeadActions} aria-hidden />
          </div>
          {libraryLoading && templates.length === 0 ? (
            <p className={styles.empty}>Loading templates…</p>
          ) : rows.length === 0 ? (
            <p className={styles.empty}>
              {templates.length === 0
                ? 'No templates in the library yet. Create one in Settings → Care Plan Library.'
                : `No templates match your search.`}
            </p>
          ) : flat ? (
            restRows.map(renderRow)
          ) : (
            [
              {
                label: 'Recommended',
                rows: recRows,
                caption: "From this patient's problem list (PAMI)",
                showReason: true,
              },
              { label: 'Favorites', rows: favRows },
              { label: 'Selected', rows: addedRows },
              { label: 'All Templates', rows: restRows },
            ]
              .filter(g => g.rows.length > 0)
              .map((g, i) => (
                <div key={g.label} className={styles.group}>
                  {i > 0 && <span className={styles.groupDivider} aria-hidden />}
                  <div className={styles.groupHead}>
                    <span className={styles.groupLabel}>{g.label}</span>
                    {g.caption && <span className={styles.groupCaption}>{g.caption}</span>}
                  </div>
                  {g.rows.map(t => renderRow(t, { showReason: g.showReason }))}
                </div>
              ))
          )}
        </div>
      </div>
      {previewTemplate && (
        <TemplatePreviewDrawer
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
        />
      )}
    </Drawer>
  );
}

// Double-chevron sort affordance, matching HeaderCell's language: idle shows
// both arrows muted, an active direction keeps the pointing arrow.
function SortGlyph({ dir }) {
  return (
    <svg
      className={`${styles.sortGlyph} ${dir ? styles.sortGlyphActive : ''}`}
      width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"
    >
      <path
        d="M12.67 6.67L8 2.67L3.33 6.67"
        stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"
        className={dir === 'desc' ? styles.sortGlyphHidden : ''}
      />
      <path
        d="M12.67 9.33L8 13.33L3.33 9.33"
        stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"
        className={dir === 'asc' ? styles.sortGlyphHidden : ''}
      />
    </svg>
  );
}
