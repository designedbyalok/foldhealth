import { useEffect, useMemo, useState } from 'react';
import { Drawer } from '../../../../../components/Drawer/Drawer';
import { Button } from '../../../../../components/Button/Button';
import { Toggle } from '../../../../../components/Toggle/Toggle';
import { Input } from '../../../../../components/Input/Input';
import { Checkbox } from '../../../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { Badge } from '../../../../../components/Badge/Badge';
import { Link } from '../../../../../components/Link/Link';
import { PriorityIcon } from '../../../../../components/PriorityIcon/PriorityIcon';
import { AddIconMinimalist } from '../../../../../components/Icon/AddIconMinimalist';
import { CreateGoalDrawer } from '../CreateGoalDrawer/CreateGoalDrawer';
import { toast } from '../../../../../components/Toast/sonnerToast';
import { GOAL_CATEGORIES, normalizeCategory } from '../../lib/goalCategories';
import { useAppStore } from '../../../../../store/useAppStore';
import { formatGoalTarget, formatGoalDuration } from '../../lib/goalFormat';
import styles from './AddGoalsDrawer.module.css';

// Rows shown under "Recently Used" — the newest goals in the library. There
// is no per-user usage log, so recency stands in for it.
const RECENT_COUNT = 5;

// A library goal's second line: what it measures, then how long for.
function goalDetail(g) {
  const target = formatGoalTarget(g);
  return [[g.measure, target].filter(Boolean).join(' '), formatGoalDuration(g)]
    .filter(Boolean)
    .join(' • ');
}

/**
 * Add Goals — goal picker for the New Care Plan screen.
 * Figma Care-Plan-Creation 14109:296954.
 */
export function AddGoalsDrawer({ onClose, onAdd }) {
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

  // The hairline sits after the last "Recently Used" row, and only while the
  // list is unfiltered — otherwise the grouping is meaningless.
  const showRecentLabel = category === 'All' && !query.trim();
  const lastRecentId = showRecentLabel
    ? [...rows].reverse().find(g => g.recent)?.id
    : null;

  const headerRight = (
    <>
      <Button
        variant="primary"
        size="L"
        disabled={selected.size === 0}
        onClick={() => onAdd?.(goals.filter(g => selected.has(g.id)))}
      >
        Add
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
          {showRecentLabel && <span className={styles.groupLabel}>Recently Used</span>}
          {rows.length === 0 ? (
            <p className={styles.empty}>
              {goals.length === 0
                ? 'No goals in the library yet.'
                : `No goals match “${query.trim()}”.`}
            </p>
          ) : rows.map(g => (
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
                <span className={styles.rowMeta}>
                  {g.category && <Badge tone="grey" size="S" label={normalizeCategory(g.category)} />}
                  <PriorityIcon priority={g.priority} size={16} />
                </span>
              </label>
              {g.id === lastRecentId && <span className={styles.groupDivider} />}
            </div>
          ))}
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
